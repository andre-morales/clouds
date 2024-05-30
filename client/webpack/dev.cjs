const master = require('./master.cjs');

master.mode = 'development';
master.devtool = 'eval';

module.exports = master;
