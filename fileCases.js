module.exports = {
  "titans": function(url, { seasonNum, episodeNum }) {
    return seasonNum == '01' && Number(episodeNum) < 9 ? url + '1' : url;
  }
}