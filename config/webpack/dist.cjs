const master = require('./master.cjs');

master.mode = 'production';
master.devtool = 'source-map';

module.exports = master;
