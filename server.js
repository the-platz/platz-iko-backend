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

app.get('/campaigns/account/:accountId', function(req, res) {
  const account_id = `"${req.params.accountId}"`
  console.log(account_id)
  const iko_master_account_id = process.env.IKO_MASTER_ACCOUNT_ID
  const iko_sub_account_id = `%.${process.env.IKO_MASTER_ACCOUNT_ID}`

  const pool = new Pool({
    connectionString,
  })

  const my_campaigns_query = {
    name: 'my_campaigns_query',
    text: `
    -- user's campaigns
    select r.receiver_account_id as campaign_account_id,
      ara.args -> 'args_json' -> 'campaign_beneficiary' as campaign_beneficiary
    from public.access_keys ak 
    inner join receipts r on r.receipt_id = ak.created_by_receipt_id
    inner join public.action_receipt_actions ara on ara.receipt_id = r.receipt_id 
    where ak.deleted_by_receipt_id is null
      -- check validity of campaign
      and r.predecessor_account_id = $1 --'iko.theplatz.testnet' 
      and r.receiver_account_id like $2 --'%.iko.theplatz.testnet'
      and ara."action_kind" = 'FUNCTION_CALL'
      and (ara.args -> 'method_name')::text = '"new"'  -- casting to text results in -> "data inside the quote"
      and (ara.args -> 'args_json' -> 'campaign_beneficiary')::text = $3 -- '"phatngluu.testnet"';`,
      values: [
        iko_master_account_id, 
        iko_sub_account_id, 
        account_id
      ]
    }

    pool.query(my_campaigns_query, (err, result) => {
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

app.get('/transactions/donation', function (req, res) {
    let sender_account_id_filter = req.query.account_id
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

app.listen(port);

console.log('RESTful API server started on: ' + port);