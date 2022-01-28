require('dotenv').config();
const { Pool } = require('pg')
let express = require('express');
let app = express();
let port = process.env.PORT || 3000;
let connectionString = process.env.INDEXER_DB_CONN;
console.log(connectionString)

app.get('/donation_history', function (req, res) {
    let account_id = req.query.account_id
    console.log(account_id)
    const pool = new Pool({
      connectionString,
    })

    const donation_history_query = {
      name: 'donation_history_query',
      text: `
        SELECT t.transaction_hash, t.block_timestamp, ta.args -> 'deposit' as donation_amount, r.receipt_id, eo.status 
        FROM public.transactions t
        inner join public.transaction_actions ta on t.transaction_hash = ta.transaction_hash
        right join public.receipts r  on r.originated_from_transaction_hash = t.transaction_hash
        inner join public.execution_outcomes eo on eo.receipt_id = r.receipt_id
        where t.signer_account_id = $1 and ta.args -> 'method_name' = '"donate"';`,
      values: [account_id]
    }

    pool.query(donation_history_query, (err, result) => {
      if (err) {
        res.json({
          success: false,
          data: err
        })

        return
      }
      let transaction_map  = new Map();

      result.rows.forEach((row, _, __) => {
        const tx_hash = row.transaction_hash
        let tx_info = transaction_map.get(tx_hash)

        if (!tx_info) {
          tx_info = {
            transaction_hash: tx_hash,
            block_timestamp: row.block_timestamp,
            donation_amount: row.donation_amount,
            tx_succeeded: true, // default
          }
        }

        if (row.status == 'FAILURE') {
          tx_info.tx_succeeded = false
        }

        transaction_map.set(tx_hash, tx_info)
      })

      res.json({
        success: true,
        data: Array.from(transaction_map.values())
      })
      pool.end()
    })
})

app.listen(port);

console.log('RESTful API server started on: ' + port);