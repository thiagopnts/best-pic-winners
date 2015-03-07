require('./scrapper')
  .run()
  .then(function(result) {
    console.log('Average budget:', result.formattedAverage);
  });

