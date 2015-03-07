var Intl = require('intl');
var Promise = require('bluebird');
var request = require('request');
var winston = require('winston');
var $ = require('jquery')(require("jsdom").jsdom().parentWindow);

Promise.promisifyAll(request);

var domain = 'http://en.wikipedia.org';
var rootUrl = domain + '/wiki/Academy_Award_for_Best_Picture';

var BUDGET_NOT_INFORMED = 'NOT INFORMED';

var logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      level: process.env.LOGGING_LEVEL || 'info',
      colorize: true
    })
  ]
});

function run() {
  logger.info('Running...');
  return request
    .getAsync(rootUrl)
    .spread(parseRootPage)
    .map(extractMovieUrlAndYear)
    .map(fetchMoviePage)
    .map(extractBudget)
    .filter(removeMoviesWithoutBudget)
    .map(normalizeCurrency)
    .map(printData)
    .all()
    .then(calculateAverage)
    .catch(handleError);
}

function removeMoviesWithoutBudget(movie) {
  return movie.budget !== BUDGET_NOT_INFORMED;
}

function handleError(err) {
  logger.error('Something went wrong:', err.message);
}

function parseRootPage(response, body) {
  return $(body)
    .find('#mw-content-text tbody')
    .toArray()
    .slice(2, 89);
}

function printData(movie) {
  console.log(movie.year, movie.title, movie.budget);
  return movie;
}

function extractMovieUrlAndYear(element) {
  var $element = $(element);
  var url = domain + $element.find('tr:nth-child(2)').find('a').attr('href');
  var year = $element.parent().find('big a').html();
  logger.debug('Extracted URL:', url);
  logger.debug('Extracted Year:', year);
  return {url: url, year: year};
}

function fetchMoviePage(data) {
  logger.debug('Fetching ', data.url);
  return request.getAsync(data.url).spread(function(response, body) {
    return {year: data.year, body: body};
  });
};

function extractBudget(data) {
  logger.debug("Extracting budget from year's", data.year, "winner");
  $body = $(data.body);
  var budgetElement = $body
    .find('.infobox.vevent tbody')
    .first()
    .find('tr')
    .filter(function(i, el) {
        var th = $(el).find('th').html();
        return th && th.match(/budget/i);
    })
    .find('td');
  budgetElement.children().remove();
  var budget = budgetElement.html();
  budget = budget ? budget.replace(/&nbsp;/, ' ') : BUDGET_NOT_INFORMED;
  var title = $body.find('#firstHeading i').html();
  logger.debug("Extracted title:", title);
  logger.debug("Extracted budget:", budget);

  return {year: data.year, title: title, budget: budget};
}

function normalizeCurrency(result) {
  var budget = result.budget;
  logger.debug('Normalizing', budget);
  var currency = budget.match(/([u?s?\$?]|£?)/i)[1];
  var value = function() {
    var isUnabbreviated = budget.indexOf('million') >= 0;
    if (isUnabbreviated) {
      var number = budget.split(' ')[0];
      var value = parseInt((parseFloat(number.match(/(\d*\.?\d+)/i)[1]) * 1000000).toFixed(), 10);
      return value;
    } else if (budget === BUDGET_NOT_INFORMED) {
      return 0;
    } else {
      return parseInt(budget.replace(/,|\./g, '').match(/(\d+)/)[1], 10);
    }
  }();

  return $.extend(result, {normalizedBudget: currency === '£' ? value * 1.5 : value});
}

function calculateAverage(movies) {
  var sum = movies.reduce(function(acc, movie) {
    return acc + movie.normalizedBudget;
  }, 0);
  var average = (sum / movies.length).toFixed();
  var numberFormat = new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'USD', minimumFractionDigits: 0});
  return {average: parseInt(average, 10), sum: sum, formattedAverage: numberFormat.format(average)};
}

module.exports = {
  calculateAverage: calculateAverage,
  normalizeCurrency: normalizeCurrency,
  extractMovieUrlAndYear: extractMovieUrlAndYear,
  removeMoviesWithoutBudget: removeMoviesWithoutBudget,
  extractBudget: extractBudget,
  fetchMoviePage: fetchMoviePage,
  run: run
};
