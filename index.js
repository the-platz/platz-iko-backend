require('dotenv').config();

let express = require('express');
let app = express();

const campaigns = require("./api/campaigns");
const transactions = require("./api/transactions");

app.use(function (req, res, next) {
  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', '*');

  next();
});

app.use(express.json({ extended: false }));

app.use("/campaigns", campaigns);
app.use("/transactions", transactions);

app.listen(process.env.PLATZ_IKO_BACKEND_PORT || 5000);
console.log('PORT: ' + process.env.PLATZ_IKO_BACKEND_PORT || 5000);