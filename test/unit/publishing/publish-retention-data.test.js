jest.mock('../../../app/publishing/get-pending-retention-data')
jest.mock('../../../app/messaging/send-publish-message')
jest.mock('../../../app/data')
jest.mock('../../../app/publishing/get-mapped-agreement-number')

const { getPendingRetentionData } = require('../../../app/publishing/get-pending-retention-data')
const sendPublishMessage = require('../../../app/messaging/send-publish-message')
const db = require('../../../app/data')
const { getMappedAgreementNumber } = require('../../../app/publishing/get-mapped-agreement-number')
const { publishRetentionData } = require('../../../app/publishing/publish-retention-data')
const { SFI_PILOT, CS, MANUAL, SFI23, WMP } = require('../../../app/constants/schemes')
const { SFI_PILOT: SFI_PILOT_PILLAR, CS: CS_PILLAR, SFI23: SFI23_PILLAR } = require('../../../app/constants/pillars')

describe('publishRetentionData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    db.retentionData = {
      destroy: jest.fn().mockResolvedValue(1)
    }
    sendPublishMessage.mockResolvedValue(undefined)
    getMappedAgreementNumber.mockImplementation((schemeId, agreementNumber) => agreementNumber)
  })

  test('should get pending retention data', async () => {
    getPendingRetentionData.mockResolvedValue([])

    await publishRetentionData()

    expect(getPendingRetentionData).toHaveBeenCalledTimes(1)
  })

  test('should process all pending retention data items', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: 'AGR001' },
      { retentionDataId: 2, frn: 'FRN002', agreementNumber: 'AGR002' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)

    await publishRetentionData()

    expect(sendPublishMessage).toHaveBeenCalledTimes(2)
    expect(db.retentionData.destroy).toHaveBeenCalledTimes(1)
  })

  test('should send publish message with correct pending data', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: 'AGR001' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)

    await publishRetentionData()

    expect(sendPublishMessage).toHaveBeenCalledWith(expect.objectContaining({
      retentionDataId: 1,
      frn: 'FRN001',
    }))
  })

  test('should destroy record with correct retentionDataId', async () => {
    const mockData = [
      { retentionDataId: 123, frn: 'FRN001', agreementNumber: 'AGR001' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)

    await publishRetentionData()

    expect(db.retentionData.destroy).toHaveBeenCalledWith({
      where: { retentionDataId: [123] }
    })
  })

  test('should log data passing retention with frn and agreement number', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: 'AGR001' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    await publishRetentionData()

    expect(consoleSpy).toHaveBeenCalledWith(
      'Data passed 7 year retention for frn: FRN001, agreement number: AGR001'
    )
    consoleSpy.mockRestore()
  })

  test('should log notification supplied to downstream systems after each item', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: 'AGR001' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    await publishRetentionData()

    expect(consoleSpy).toHaveBeenCalledWith('Notifications supplied to downstream systems')
    consoleSpy.mockRestore()
  })

  test('should handle empty pending data array', async () => {
    getPendingRetentionData.mockResolvedValue([])

    await publishRetentionData()

    expect(sendPublishMessage).not.toHaveBeenCalled()
    expect(db.retentionData.destroy).not.toHaveBeenCalled()
  })

  test('should throw error when getPendingRetentionData fails', async () => {
    const testError = new Error('Database error')
    getPendingRetentionData.mockRejectedValue(testError)

    await expect(publishRetentionData()).rejects.toThrow('Database error')
  })

  test('should throw error when sendPublishMessage fails', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: 'AGR001' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    const testError = new Error('Message send failed')
    sendPublishMessage.mockRejectedValue(testError)

    await expect(publishRetentionData()).rejects.toThrow('Message send failed')
  })

  test('should throw error when destroy fails', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: 'AGR001' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    const testError = new Error('Destroy failed')
    db.retentionData.destroy.mockRejectedValue(testError)

    await expect(publishRetentionData()).rejects.toThrow('Destroy failed')
  })

  test('should process items sequentially', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: 'AGR001' },
      { retentionDataId: 2, frn: 'FRN002', agreementNumber: 'AGR002' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    const callOrder = []
    sendPublishMessage.mockImplementation((data) => {
      callOrder.push(`message-${data.retentionDataId}`)
      return Promise.resolve()
    })
    db.retentionData.destroy.mockImplementation((query) => {
      callOrder.push(`destroy-${query.where.retentionDataId}`)
      return Promise.resolve()
    })

    await publishRetentionData()

    expect(callOrder).toEqual([
      'message-1',
      'message-2',
      'destroy-1,2'
    ])
  })

  test('should handle multiple items with different frn and agreement numbers', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: 'AGR001' },
      { retentionDataId: 2, frn: 'FRN002', agreementNumber: 'AGR002' },
      { retentionDataId: 3, frn: 'FRN003', agreementNumber: 'AGR003' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    await publishRetentionData()

    const logCalls = consoleSpy.mock.calls.filter(call =>
      call[0].includes('Data passed 7 year retention')
    )
    expect(logCalls).toHaveLength(3)
    consoleSpy.mockRestore()
  })

  test('should map agreementNumber and set usesContractNumber correctly', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: '123', schemeId: SFI_PILOT },
      { retentionDataId: 2, frn: 'FRN002', agreementNumber: '456', schemeId: CS },
      { retentionDataId: 3, frn: 'FRN003', agreementNumber: '789', schemeId: 'OTHER' }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)

    getMappedAgreementNumber.mockImplementation((schemeId, agreementNumber) => {
      return `mapped-${agreementNumber}`
    })

    await publishRetentionData()

    expect(getMappedAgreementNumber).toHaveBeenCalledTimes(3)
    expect(sendPublishMessage).toHaveBeenCalledWith(expect.objectContaining({
      agreementNumber: 'mapped-123',
      usesContractNumber: true
    }))
    expect(sendPublishMessage).toHaveBeenCalledWith(expect.objectContaining({
      agreementNumber: 'mapped-456',
      usesContractNumber: true
    }))
    expect(sendPublishMessage).toHaveBeenCalledWith(expect.objectContaining({
      agreementNumber: 'mapped-789',
      usesContractNumber: false
    }))
  })

  test('should send an additional manual scheme message with the pillar for the originating scheme', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: 'AGR001', schemeId: SFI23 }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)

    await publishRetentionData()

    expect(sendPublishMessage).toHaveBeenCalledTimes(2)
    expect(sendPublishMessage).toHaveBeenCalledWith(expect.not.objectContaining({
      pillar: expect.anything()
    }))
    expect(sendPublishMessage).toHaveBeenCalledWith(expect.objectContaining({
      retentionDataId: 1,
      schemeId: SFI23
    }))
    expect(sendPublishMessage).toHaveBeenCalledWith(expect.objectContaining({
      retentionDataId: 1,
      schemeId: MANUAL,
      pillar: SFI23_PILLAR
    }))
  })

  test('should carry mapped agreement number and usesContractNumber onto the manual scheme message', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: '123', schemeId: SFI_PILOT },
      { retentionDataId: 2, frn: 'FRN002', agreementNumber: '456', schemeId: CS }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)
    getMappedAgreementNumber.mockImplementation((schemeId, agreementNumber) => `mapped-${agreementNumber}`)

    await publishRetentionData()

    expect(sendPublishMessage).toHaveBeenCalledTimes(4)
    expect(sendPublishMessage).toHaveBeenCalledWith(expect.objectContaining({
      schemeId: MANUAL,
      pillar: SFI_PILOT_PILLAR,
      agreementNumber: 'mapped-123',
      simplifiedAgreementNumber: '123',
      usesContractNumber: true
    }))
    expect(sendPublishMessage).toHaveBeenCalledWith(expect.objectContaining({
      schemeId: MANUAL,
      pillar: CS_PILLAR,
      agreementNumber: 'mapped-456',
      simplifiedAgreementNumber: '456',
      usesContractNumber: true
    }))
  })

  test('should not send a manual scheme message for schemes without a pillar', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: 'AGR001', schemeId: WMP },
      { retentionDataId: 2, frn: 'FRN002', agreementNumber: 'AGR002', schemeId: MANUAL }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)

    await publishRetentionData()

    expect(sendPublishMessage).toHaveBeenCalledTimes(2)
    expect(sendPublishMessage).not.toHaveBeenCalledWith(expect.objectContaining({
      pillar: expect.anything()
    }))
  })

  test('should destroy each retention record once regardless of the number of messages sent', async () => {
    const mockData = [
      { retentionDataId: 1, frn: 'FRN001', agreementNumber: 'AGR001', schemeId: SFI23 }
    ]
    getPendingRetentionData.mockResolvedValue(mockData)

    await publishRetentionData()

    expect(db.retentionData.destroy).toHaveBeenCalledWith({
      where: { retentionDataId: [1] }
    })
  })
})
