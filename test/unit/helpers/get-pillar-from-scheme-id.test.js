const { getPillarFromSchemeId } = require('../../../app/helpers/get-pillar-from-scheme-id')
const { SFI, SFI_PILOT, DELINKED, COHT_CAPITAL, MANUAL, WMP } = require('../../../app/constants/schemes')

describe('getPillarFromSchemeId', () => {
  test.each([
    [SFI, 'SFI'],
    [SFI_PILOT, 'SFIP'],
    [DELINKED, 'DP'],
    [COHT_CAPITAL, 'COHTC']
  ])('should return the pillar for scheme %s', (schemeId, pillar) => {
    expect(getPillarFromSchemeId(schemeId)).toBe(pillar)
  })

  test('should return null for the manual scheme', () => {
    expect(getPillarFromSchemeId(MANUAL)).toBeNull()
  })

  test('should return null for a scheme without a pillar', () => {
    expect(getPillarFromSchemeId(WMP)).toBeNull()
  })

  test('should return null for an unknown scheme', () => {
    expect(getPillarFromSchemeId(999)).toBeNull()
  })

  test('should return null when no scheme id is provided', () => {
    expect(getPillarFromSchemeId(undefined)).toBeNull()
  })
})
