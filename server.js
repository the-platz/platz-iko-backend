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

    let donation_history_query = `
      SELECT t.transaction_hash, t.block_timestamp, ta.args -> 'deposit' as donation_amount, r.receipt_id, eo.status 
      FROM public.transactions t
      inner join public.transaction_actions ta on t.transaction_hash = ta.transaction_hash
      right join public.receipts r  on r.originated_from_transaction_hash = t.transaction_hash
      inner join public.execution_outcomes eo on eo.receipt_id = r.receipt_id
      where t.signer_account_id = 'phatngluu.testnet' and 
        ta.args -> 'method_name' = '"donate"';
    `

    pool.query(donation_history_query, (err, res) => {
      console.log(err, res)
      pool.end()
    })

    res.json("")
})

app.listen(port);

console.log('RESTful API server started on: ' + port);