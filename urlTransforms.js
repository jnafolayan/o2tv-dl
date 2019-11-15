const fileCases = require('./fileCases');

const generateServerId = () => 2 + Math.floor(Math.random() * 6)

module.exports = [
  ({ id, repo, series, season, episode, seasonNum, episodeNum, format }) => {
    // const serverId = generateServerId()
    
    let filename;
    if (format == 'hd')
      filename = `${series} - S${seasonNum}E${episodeNum} HD (${repo})`;
    else
      filename = `${series} - S${seasonNum}E${episodeNum} (${repo})`;

    if (fileCases[series.toLowerCase()])
      filename = fileCases[series.toLowerCase()](filename, { seasonNum, episodeNum });

    filename += ' qvlma';

    if (format == 'hd')
      filename += '.mp4';
    else
      filename += `.${format}`;
    
    const url = `http://d${id}.o2tvseries.club/${series}/${season}/${filename}`;  

    return { url, filename }
  },

  ({ id, repo, series, season, episode, seasonNum, episodeNum, format }) => {
    // const id = generateServerId()

    let filename;
    if (format == 'hd')
      filename = `${series} - S${seasonNum}E${episodeNum} HD (${repo})`;
    else
      filename = `${series} - S${seasonNum}E${episodeNum} (${repo})`;

    if (fileCases[series.toLowerCase()])
      filename = fileCases[series.toLowerCase()](filename, { seasonNum, episodeNum });

    if (format == 'hd')
      filename += '.mp4';
    else
      filename += `.${format}`;
    
    const url = `http://d${id}.o2tvseries.com/${series}/${season}/${filename}`;  

    return { url, filename }
  },
]