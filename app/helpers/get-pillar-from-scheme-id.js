const schemes = require('../constants/schemes')
const pillars = require('../constants/pillars')

const getPillarFromSchemeId = (schemeId) => {
  const matchingScheme = Object.keys(schemes)
    .find(scheme => schemes[scheme] === schemeId)
  return matchingScheme ? pillars[matchingScheme] ?? null : null
}

module.exports = {
  getPillarFromSchemeId
}
