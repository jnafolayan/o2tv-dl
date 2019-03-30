const cheerio = require('cheerio');

function parsePage(html) {
  const $ = cheerio.load(html);
  const result = $('.data_list .data a').map((i, el) => {
    const $el = $(el);
    return {
      text: $el.text(),
      link: $el.attr('href')
    };
  }).get();
  const perPage = result.length;

  let {
    text,
    link
  } = result[result.length - 1];
  let num = +extractNum(text);

  for (let i = num - 1; i > 0; i--) {
    let newText = text.replace(/(\d+)$/, i < 10 ? String(i).padStart(2, '0') : String(i));
    let newLink = link.replace(text.replace(' ', '-'), newText.replace(' ', '-'));
    result.push({
      text: newText,
      link: newLink
    });
  }

  return result;
}

function extractNum(string) {
  return string.match(/(\d+)/g).shift();
}

module.exports = {
  parsePage
};