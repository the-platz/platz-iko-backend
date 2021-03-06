const express = require("express");
const router = express.Router();

const { Pool } = require('pg')
let connectionString = process.env.INDEXER_DB_CONN;

router.get('/donation', function (req, res) {
    let sender_account_id_filter = req.query.accountId
    // TODO: env var
    let receiver_account_id_filter = `%${process.env.IKO_MASTER_ACCOUNT_ID}`
    let tx_status_filter =
        req.query.includeFailedTxs == 'true' ? '%SUCCESS_VALUE' : 'SUCCESS_VALUE'
    let limit = parseInt(req.query.limit)
    let offset = parseInt(req.query.offset)

    const pool = new Pool({
        connectionString,
    })

    const donation_history_query = {
        name: 'donation_history_query',
        text: `
        select txs.transaction_hash,
          txs.receiver_account_id,
          txs.block_timestamp,
          txs.donation_amount,
          txs.statuses,
          case when txs.statuses like 'FAILURE%' 
          then true else false
          end as is_failed
        from (
          select t_sub.transaction_hash, 
            (array_agg(t_sub.receiver_account_id))[1] as receiver_account_id, 
            (array_agg(t_sub.block_timestamp))[1] as block_timestamp,
            ta.args -> 'deposit' as donation_amount,
            string_agg(distinct eo.status::text, ',') as statuses
          from public.transactions t_sub
          inner join public.transaction_actions ta on t_sub.transaction_hash = ta.transaction_hash
          right join public.receipts r  on r.originated_from_transaction_hash = t_sub.transaction_hash
          inner join public.execution_outcomes eo on eo.receipt_id = r.receipt_id
          where t_sub.signer_account_id = $1
            and t_sub.receiver_account_id like $2
            and ta.args -> 'method_name' = '"donate"'
          group by t_sub.transaction_hash, t_sub.receiver_account_id, t_sub.block_timestamp, ta.args
          having string_agg(distinct eo.status::text, ',') like $3
          ) as txs
        order by txs.block_timestamp desc
        limit $4 offset $5;`,
        values: [
            sender_account_id_filter,
            receiver_account_id_filter,
            tx_status_filter,
            limit,
            offset
        ]
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

module.exports = router;