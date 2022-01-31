require('dotenv').config();
const { Pool } = require('pg')
let express = require('express');
let app = express();
let port = process.env.PLATZ_IKO_BACKEND_PORT || 5000;
let connectionString = process.env.INDEXER_DB_CONN;
console.log(connectionString)

app.use(function (req, res, next) {

  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', '*');

  next();
});

app.get('/transaction/receipts', function (req, res) {
    let tx_hash = req.query.tx_hash

    const pool = new Pool({
      connectionString,
    })

    const tx_status_query = {
      name: 'tx_status_query',
      text: `SELECT t.transaction_hash, r.receipt_id , eo.status
      FROM public.transactions t
      right join public.receipts r  on r.originated_from_transaction_hash = t.transaction_hash
      inner join public.execution_outcomes eo on eo.receipt_id = r.receipt_id
      where transaction_hash = $1;`,
      values: [tx_hash]
    }

    pool.query(tx_status_query, (err2, result) => {
      if (err2) {
        res.status(500).json({
          success: false,
          data: err2
        })

        return
      }

      res.status(200).json({
        success: true,
        data: result.rows
      })
      pool.end()
    })
})

app.get('/transaction/donation', function (req, res) {
    let account_id = req.query.account_id
    let limit = parseInt(req.query.limit)
    let offset = parseInt(req.query.offset)

    console.log(account_id)
    const pool = new Pool({
      connectionString,
    })

    const donation_history_query = {
      name: 'donation_history_query',
      text: `
        SELECT t.transaction_hash, t.receiver_account_id, t.block_timestamp, ta.args -> 'deposit' as donation_amount
        FROM public.transactions t
        inner join public.transaction_actions ta on t.transaction_hash = ta.transaction_hash
        where t.signer_account_id = $1 and ta.args -> 'method_name' = '"donate"'
        limit $2 offset $3;`,
      values: [account_id, limit, offset]
    }

    pool.query(donation_history_query, (err, result) => {
      if (err) {
        res.status(500).json({
          success: false,
          data: err
        })

        return
      }

      res.status(200).json({
        success: true,
        data: result.rows
      })
      pool.end()
    })
})

app.listen(port);

console.log('RESTful API server started on: ' + port);