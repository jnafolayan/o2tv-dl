#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  exec
} = require('child_process');

const program = require('commander');
const axios = require('axios');
const httpAdapter = require('axios/lib/adapters/http');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ProgressBar = require('progress');
const scraper = require('./scraper');
const fileCases = require('./fileCases');
const routes = require('./routes');
const logger = require('./logger');

const session = {
  series: null
};

const MAX_REQUESTS_RETRY = 5;

program
  .version(require('./package.json').version, '-v, --version')
  .usage('[options] <series>')
  .description('search for movies with the specified tags')
  .option('-t, --timeout [timeout]', 'how long can a request take', 60)
  .option('-f, --format [format]', 'the video format (3gp, mp4, HD)', 'mp4')
  .action(function search(series, options) {
    if (!options) {
      options = series;
      series = '';
    }

    session.series = series.toLowerCase();
    session.format = options.format.toLowerCase();
    session.timeout = parseInt(options.timeout, 10);

    // get all series
    grabAllSeriesCache()
      .catch(fetchAllSeries)
      .then(runSearch)
      .then(grabSeriesMatch)
      .then(requestUserSeriesChoice)
      .then(fetchSeriesInfo)
      .then(requestUserSeasonChoice)
      .then(fetchEpisodesInfo)
      .then(requestUserEpisodeChoice)
      .then(downloadEpisode)
      .catch(err => {
        logger.error(`An error occured. Details:\n${err}`);
        end(1);
      });
  });

program.parse(process.argv);

function end(code, msg) {
  if (msg) {
    if (code == 1)
      logger.error(msg);
    else
      console.log(msg);
  }
  process.exit(code || 0);
}

function grabAllSeriesCache() {
  const dir = path.resolve(__dirname, 'results-cache.json');
  return new Promise((resolve, reject) => {
    fs.readFile(dir, 'utf-8', (err, data) => {
      if (err)
        reject(err);
      else {
        const {
          time,
          results
        } = JSON.parse(data);
        // check if diff is greater than an hour
        if (Date.now() - time > 1000 * 60 * 60 * 24) {
          logger.info('Stale data found in cache. Fetching new data...');
          reject(new Error('Stale'));
        } else
          resolve(results);
      }
    });
  });
}

const requests = {};

function curl(url) {
  if (!requests[url]) requests[url] = 0;
  requests[url]++;

  return axios.get(url)
    .then(response => response.data)
    .catch(err => {
      if (requests[url] == MAX_REQUESTS_RETRY) {
        end(1, 'An error occured due to network failure');
      } else {
        logger.info('Couldn\'t connect to the internet. Retrying...');
        return curl(url);
      }
    });
}

function fetchAllSeries() {
  logger.info('Fetching series...');

  return curl(routes.getAllSeries)
    .then(extractAllSeries)
    .then(cacheAllSeries);

  function extractAllSeries(page) {
    return scraper.parsePage(page);
  }

  function cacheAllSeries(seriesList) {
    const dir = path.resolve(__dirname, 'results-cache.json');

    const contents = JSON.stringify({
      time: Date.now(),
      results: seriesList
    });

    return new Promise((resolve, reject) => {
      fs.writeFile(dir, contents, err => {
        if (err)
          reject(err);
        else
          resolve(seriesList);
      });
    });
  }
}

function runSearch(seriesList) {
  const key = session.series;

  // compute scores
  if (key)
    seriesList.forEach(series => {
      series.ops = computeOps(series, key);
    });

  return seriesList;
}

function computeOps(series, key) {
  let {
    text
  } = series;

  const a = text.toLowerCase().replace(/ /g, '');
  const b = key;

  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let i = 0; i <= a.length; i++) {
    matrix[0][i] = i;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1);
      }
    }
  }

  return matrix[b.length][a.length];
}

function grabSeriesMatch(seriesList) {
  // sort series in order of fitness
  seriesList.sort((a, b) => a.ops - b.ops);

  const candidates = [seriesList.shift()];

  // pick all with equal ops
  for (let series of seriesList) {
    if (series.ops == candidates[0].ops)
      candidates.push(series);
    else
      break;
  }

  return candidates;
}

function requestUserSeriesChoice(results) {
  const choices = results.map(series => series.text);

  return new Promise((resolve, reject) => {
    inquirer.prompt([{
        type: 'list',
        name: 'series',
        message: `${results.length} series found. Pick one:`,
        choices
      }])
      .then(({
        series
      }) => {
        session.series = series;
        resolve(results.find(s => s.text == series));
      });
  });
}

function fetchSeriesInfo({
  text,
  link
}) {
  logger.info(`Fetching available seasons of ${chalk.whiteBright(text)}...`);

  return curl(link)
    .then(extractSeriesInfo);

  function extractSeriesInfo(page) {
    return scraper.parsePage(page);
  }
}

function requestUserSeasonChoice(results) {
  const choices = results.map(series => series.text);

  return new Promise((resolve, reject) => {
    inquirer.prompt([{
        type: 'list',
        name: 'season',
        message: `${results.length} seasons found. Pick one:`,
        choices
      }])
      .then(({
        season
      }) => {
        session.season = season;
        resolve(results.find(s => s.text == season));
      });
  });
}

function fetchEpisodesInfo({
  text,
  link
}) {
  logger.info(`Fetching available episodes of ${chalk.whiteBright(text)}...`);

  return curl(link)
    .then(extractEpisodesInfo);

  function extractEpisodesInfo(page) {
    return scraper.parsePage(page);
  }
}

function requestUserEpisodeChoice(results) {
  const choices = results.map(series => series.text);

  return new Promise((resolve, reject) => {
    inquirer.prompt([{
        type: 'list',
        name: 'episode',
        message: `${results.length} episodes found. Pick one:`,
        choices
      }])
      .then(({
        episode
      }) => {
        session.episode = episode;
        resolve(results.find(s => s.text == episode));
      });
  });
}

function downloadEpisode({
  text,
  link
}) {
  const {
    series,
    season,
    episode,
    format
  } = session;

  const seasonNum = extractNum(season);
  const episodeNum = extractNum(episode);
  const sites = ['O2TvSeries.Com', 'TvShows4Mobile.Com'].reverse();
  let siteIndex = 0;

  let retryCount = -1;

  logger.info('Connecting to file server...');
  logger.warn('It may take long to start the download. Quit the program whenever you feel like');

  connect();

  function connect(err) {
    if (++retryCount)
      logger.info('Couldn\'t connect to the server. Retrying...');

    const serverId = 2 + Math.floor(Math.random() * 6);
    let filename;
    if (format == 'HD')
      filename = `${series} - S${seasonNum}E${episodeNum} HD (${sites[siteIndex]})`;
    else
      filename = `${series} - S${seasonNum}E${episodeNum} (${sites[siteIndex]})`;

    if (fileCases[series.toLowerCase()])
      filename = fileCases[series.toLowerCase()](filename);

    if (format == 'HD')
      filename += '.mp4';
    else
      filename += `.${format}`;

    const url = `http://d${serverId}.o2tvseries.com/${series}/${season}/${filename}`;  

    if (++siteIndex >= sites.length)
      siteIndex = 0;

    return axios.get(url, { responseType: 'stream', adapter: httpAdapter })
      .then(({
        headers,
        data
      }) => {
        console.log(url);
        const size = parseInt(headers['content-length'], 10);
        fs.exists(filename, exists => {
          if (exists)
            fs.unlink(filename, () => download(filename, data, size));
          else 
            download(filename, data, size);
        });
      })
      .catch(connect);
  }

  function download(filename, stream, size) {
    logger.info(`Downloading ${chalk.whiteBright(filename)} --> ${path.resolve('.')}`);
    let barComplete = false;

    const bar = new ProgressBar('  downloading [:bar] :rate/bps :percent :etas', {
      complete: '=',
      incomplete: ' ',
      width: 25,
      total: size,
      stream: process.sdout,
      callback() {
        barComplete = true;
      }
    });

    const output = fs.createWriteStream(filename);

    stream.on('data', chunk => {
      bar.tick(chunk.length);
      output.write(Buffer.from(chunk));
    });

    stream.on('end', () => {
      setTimeout(() => {
        output.end();
        console.log('');
        logger.info('Connection to server has closed');
        if (barComplete)
          logger.success('Download successful');
        end();
      }, 1000);
    });
  }

  function extractNum(string) {
    return string.match(/(\d+)/g).shift();
  }
}