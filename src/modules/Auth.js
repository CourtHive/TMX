import axios from 'axios';
import qs from 'qs';

const Auth = async (username, password, site) => {
  const GRANT_TYPE = 'password';

  if (!(username && password && site)) throw new Error('Username, Password or site not set');

  const url = `https://sportlabs-sportbench-itf-sso-${site}.azurewebsites.net/issue/oauth2/token`;
  const scope = `https://sportlabs-sportbench-itf-api-${site}.azurewebsites.net/token/`;

  const data = qs.stringify({
    grant_type: GRANT_TYPE,
    username,
    password,
    scope
  });
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: 'Basic c3dhZ2dlci11aTpzdXBlcnNlY3JldA=='
  };
  const authOptions = {
    method: 'POST',
    url,
    data,
    headers
  };

  let res = await axios(authOptions);
  if (!(res && res.data && res.data.access_token)) throw new Error('failed to obtain a token');
  return res.data.access_token;
};

export default Auth;
