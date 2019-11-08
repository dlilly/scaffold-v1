const levenshtein = require('js-levenshtein');

let l = levenshtein('customer', 'products');

console.log(l)