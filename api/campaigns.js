const express = require("express");
const router = express.Router();

const { Pool } = require('pg')
let connectionString = process.env.INDEXER_DB_CONN;

router.get('/account/:accountId', function (req, res) {
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

router.get('/topDonors', function (req, res) {
    const campaign_id = req.query.campaign_id
    const TOP_DONORS_LIMIT = parseInt(process.env.CAMPAIGN_TOP_DONORS_LIMIT)

    const pool = new Pool({
        connectionString,
    })

    const campaign_top_donors_query = {
        name: 'campaign_top_donors_query',
        text: `
      -- top donors of a campaign
      select s.signer_account_id, sum(s.donation_amount) as total_donation_amount
      from (
        select t.transaction_hash, t.signer_account_id, cast(ta.args -> 'deposit' #>> '{}' as numeric) as donation_amount
        from public.transactions t
        inner join transaction_actions ta on t.transaction_hash = ta.transaction_hash
        right join public.receipts r  on r.originated_from_transaction_hash = t.transaction_hash
        inner join public.execution_outcomes eo on eo.receipt_id = r.receipt_id
        where t.receiver_account_id = $1
          and ta.args -> 'method_name' = '"donate"'
        group by t.transaction_hash, t.signer_account_id, ta.args, eo.status
        having string_agg(distinct eo.status::text, ',') like 'SUCCESS_VALUE') s
      group by s.signer_account_id
      order by total_donation_amount desc
      limit $2`,
        values: [
            campaign_id,
            TOP_DONORS_LIMIT
        ]
    }

    pool.query(campaign_top_donors_query, (err, result) => {
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