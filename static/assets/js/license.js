// ==============================================
// ARQUIVO: atlas/assets/js/license.js
// Este ambiente não usa licenciamento — stub inofensivo
// só pra não quebrar as telas que chamam License.*.
// ==============================================
const License = (() => {
  function getKey() { return null; }
  function getData() { return {}; }
  function isBlocked() { return false; }
  function getLicenseFooterText() { return ''; }
  function getLicenseFooterPDFHTML() { return ''; }
  async function check() { return true; }
  function showActivationModal() {
    Utils.showToast('Licenciamento não é usado neste ambiente.', 'info');
  }

  return { getKey, getData, isBlocked, getLicenseFooterText, getLicenseFooterPDFHTML, check, showActivationModal };
})();
