var test = require('tape');
var scrapper = require('../scrapper');
var fixtures = require('./fixtures');
var nock = require('nock');
var $ = require('jquery')(require("jsdom").jsdom().parentWindow);

test('extract movie url and year', function(test) {
  test.plan(1);

  var tbody = $('tbody', fixtures.awardTable);
  var data = scrapper.extractMovieUrlAndYear(tbody);
  test.deepEqual({year: '1927', url: 'http://en.wikipedia.org/wiki/Wings_(1927_film)'}, data);
});

test('normalize textual number without currency', function(test) {
  test.plan(2);

  var result = scrapper.normalizeCurrency({budget: '4 million'});
  test.deepEqual({budget: '4 million', normalizedBudget: 4000000}, result);

  var result = scrapper.normalizeCurrency({budget: '4.9 million'});
  test.deepEqual({budget: '4.9 million', normalizedBudget: 4900000}, result);
});

test('normalize textual number with currency', function(test) {
  test.plan(2);

  var result = scrapper.normalizeCurrency({budget: '$2 million'});
  test.deepEqual({budget: '$2 million', normalizedBudget: 2000000}, result);

  var result = scrapper.normalizeCurrency({budget: 'US$10 million'});
  test.deepEqual({budget: 'US$10 million', normalizedBudget: 10000000}, result);
});

test('normalize textual float number', function(test) {
  test.plan(2);

  var result = scrapper.normalizeCurrency({budget: '$1.2 million'});
  test.deepEqual({budget: '$1.2 million', normalizedBudget: 1200000}, result);

  var result = scrapper.normalizeCurrency({budget: 'US$5.65 million'});
  test.deepEqual({budget: 'US$5.65 million', normalizedBudget: 5650000}, result);
});

test('normalize textual number with currency', function(test) {
  test.plan(2);
  var result = scrapper.normalizeCurrency({budget: '$2 million'});
  test.deepEqual({budget: '$2 million', normalizedBudget: 2000000}, result);

  var result = scrapper.normalizeCurrency({budget: 'US$10 million'});
  test.deepEqual({budget: 'US$10 million', normalizedBudget: 10000000}, result);
});

test('normalize movie without budget', function(test) {
  test.plan(1);
  var result = scrapper.normalizeCurrency({budget: 'NOT INFORMED'});
  test.deepEqual({budget: 'NOT INFORMED', normalizedBudget: 0}, result);
});

test('normalize formatted budget', function(test) {
  test.plan(2);

  var result = scrapper.normalizeCurrency({budget: 'US$1,000,000'});
  test.deepEqual({budget: 'US$1,000,000', normalizedBudget: 1000000}, result);

  var result = scrapper.normalizeCurrency({budget: '$3.500.000'});
  test.deepEqual({budget: '$3.500.000', normalizedBudget: 3500000}, result);
});

test('normalize from ranged budget', function(test) {
  test.plan(1);

  // for this edge case we consider just the first number
  var result = scrapper.normalizeCurrency({budget: '6-7 million'});
  test.deepEqual({budget: '6-7 million', normalizedBudget: 6000000}, result);
});

test('normalize from gbp to usd', function(test) {
  test.plan(1);

  // for this edge case we convert from gbp to usd
  var result = scrapper.normalizeCurrency({budget: '£1,000,000'});
  test.deepEqual({budget: '£1,000,000', normalizedBudget: 1500000}, result);
});

test('select movies without budget', function(test) {
  test.plan(3);
  var movies = [
    {budget: 1},
    {budget: 'NOT INFORMED'},
    {budget: 3},
    {budget: 'NOT INFORMED'}
  ];

  // for this edge case we remove the movies without budget
  var result = movies.filter(scrapper.removeMoviesWithoutBudget);
  test.assert(result.length === 2);
  test.assert(result[0].budget === 1);
  test.assert(result[1].budget === 3);
});

test('calculate average', function(test) {
  test.plan(1);

  var result = scrapper.calculateAverage([
    {normalizedBudget: 10},
    {normalizedBudget: 20},
    {normalizedBudget: 30},
    {normalizedBudget: 40},
    {normalizedBudget: 50},
  ]);

  test.deepEqual({average: 30, sum: 150, formattedAverage: '$30'}, result);
});

test('extract budget', function(test) {
  test.plan(1);
  var result = scrapper.extractBudget({year: '2010', body: fixtures.infoTable});
  test.deepEqual(result, {year: '2010', title: 'Wings', budget: '2 million'});
});

test('fetch movie page', function(test) {
  test.plan(2);

  var data = {
    year: '2010',
    url: 'http://en.wikipedia.org/wiki/Wings_(1927_film)'
  };

  var pageBody = '<body><p>movie page</p></body>';

  nock('http://en.wikipedia.org')
    .get('/wiki/Wings_(1927_film)')
    .reply(200, pageBody);

  scrapper.fetchMoviePage(data)
    .then(function(movieData) {
      test.equal(movieData.year, data.year);
      test.equal(movieData.body, pageBody);
    });
});
