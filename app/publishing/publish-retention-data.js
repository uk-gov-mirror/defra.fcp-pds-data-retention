const { getPendingRetentionData } = require('./get-pending-retention-data')
const sendPublishMessage = require('../messaging/send-publish-message')
const db = require('../data')
const { getMappedAgreementNumber } = require('./get-mapped-agreement-number')
const { getPillarFromSchemeId } = require('../helpers/get-pillar-from-scheme-id')
const { SFI_PILOT, CS, MANUAL } = require('../constants/schemes')

const publishRetentionData = async () => {
  const pendingRetentionData = await getPendingRetentionData()

  if (!pendingRetentionData || pendingRetentionData.length === 0) {
    return
  }

  const messages = pendingRetentionData.flatMap(pending => {
    console.log(`Data passed 7 year retention for frn: ${pending.frn}, agreement number: ${pending.agreementNumber}`)
    pending.simplifiedAgreementNumber = pending.agreementNumber
    pending.agreementNumber = getMappedAgreementNumber(pending.schemeId, pending.agreementNumber)
    pending.usesContractNumber = [SFI_PILOT, CS].includes(pending.schemeId)

    const pillar = getPillarFromSchemeId(pending.schemeId)
    if (!pillar) {
      return [pending]
    }
    return [pending, { ...pending, schemeId: MANUAL, pillar }]
  })

  await Promise.all(messages.map(m => sendPublishMessage(m)))

  await db.retentionData.destroy({
    where: {
      retentionDataId: pendingRetentionData.map(p => p.retentionDataId)
    }
  })

  console.log('Notifications supplied to downstream systems')
}

module.exports = {
  publishRetentionData
}
