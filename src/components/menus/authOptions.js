import { getLoginState } from 'services/authentication/loginState';
import { tipster } from 'components/popovers/tipster';
import { coms } from 'services/coms';
import { lang } from 'services/translator';
import { context } from 'services/context';

import { REVOKE_AUTH } from 'constants/comsConstants';
import { SUPER_ADMIN } from 'constants/tmxConstants';

import { authorizeOfficial } from 'components/menus/auth/authorizeOfficial';
import { authorizeAdmin } from 'components/menus/auth/authorizeAdmin';
import { authorizeUser } from 'components/menus/auth/authorizeUser';

export function displayAuthOptions({ tournamentId, target } = {}) {
  const state = getLoginState();
  const admin = state?.profile?.roles?.includes(SUPER_ADMIN);

  const items = [
    {
      text: lang.tr('phrases.generatekey'),
      hide: !admin,
      onClick: authorizeUser,
      intent: 'id-success'
    },
    {
      text: 'Delegation Official',
      hide: !admin,
      onClick: authorizeOfficial
    },
    {
      text: lang.tr('administrator'),
      hide: !admin,
      onClick: authorizeAdmin
    },
    {
      text: lang.tr('revoke'),
      hide: !admin,
      onClick: revokeAuthorization,
      intent: 'id-warning'
    }
  ];

  if (admin) {
    tipster({ target, title: 'Authorization', items });
    setTimeout(function () {
      // save.cloud();
    }, 1000);
  }

  function revokeAuthorization() {
    let title = lang.tr('phrases.revokeauth');
    let buttons = [
      {
        label: lang.tr('revoke'),
        intent: 'is-warning',
        onClick: revokeIt,
        close: true
      },
      { label: lang.tr('tournaments.close'), intent: 'is-primary' }
    ];
    context.modal.open({ title, content: '', buttons });

    function revokeIt() {
      coms.emitTmx({
        data: {
          action: REVOKE_AUTH,
          payload: { tournamentId }
        }
      });
      // setUserAuth({ authorized: false });
    }
  }
}
