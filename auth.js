/*
  300 Before 30 — permanent username/password accounts.
  This file intentionally leaves the locked Home/List rendering in app.js untouched.
*/

const AUTH_EMAIL_DOMAIN = '300before30.app';

function cleanUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function usernameToEmail(username) {
  return `${cleanUsername(username)}@${AUTH_EMAIL_DOMAIN}`;
}

function validUsername(username) {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

function authViews() {
  return ['authLanding', 'authSignIn', 'authSignUp', 'authSuccess'];
}

function showAuthView(id) {
  $('#onboarding').classList.remove('hidden');
  $('#app').classList.add('hidden');

  authViews().forEach(viewId => {
    const el = $('#' + viewId);
    if (el) el.classList.toggle('hidden', viewId !== id);
  });
}

function setHelp(id, message = '', isError = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', !!isError);
}

function setInputError(id, isError) {
  const el = $(id);
  if (el) el.classList.toggle('error', !!isError);
}

function authErrorText(error) {
  const raw = String(error?.message || '').toLowerCase();

  if (
    raw.includes('invalid login') ||
    raw.includes('invalid credentials') ||
    raw.includes('email not confirmed')
  ) {
    return 'Incorrect username or password. Please try again.';
  }

  if (
    raw.includes('already registered') ||
    raw.includes('already been registered') ||
    raw.includes('user already')
  ) {
    return 'That username already has an account. Try signing in.';
  }

  if (raw.includes('password')) {
    return 'Please check your password and try again.';
  }

  return 'Something went wrong. Please try again.';
}

/* Replace the old anonymous onboarding whenever app.js asks for it. */
showOnboarding = function () {
  hideLoading();
  showAuthView('authLanding');
};

async function signInAccount(username, password) {
  const clean = cleanUsername(username);

  setHelp('#signInHelp', '');
  setInputError('#signInUsername', false);
  setInputError('#signInPassword', false);

  if (!validUsername(clean) || !password) {
    setHelp('#signInHelp', 'Enter your username and password.', true);
    return;
  }

  const button = $('#signInSubmit');
  button.disabled = true;
  button.textContent = 'Signing in…';

  try {
    showLoading('Signing you in…');

    const { data, error } = await db.auth.signInWithPassword({
      email: usernameToEmail(clean),
      password
    });

    if (error) throw error;

    currentUser = data.user;

    let { data: profile, error: profileError } = await db
      .from('profiles')
      .select('username')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (profileError) throw profileError;

    /*
      Recovery for the rare case where Auth signup succeeded previously
      but list/profile creation was interrupted before completion.
    */
    if (!profile) {
      const { error: createError } = await db.rpc(
        'create_profile_and_list',
        { chosen_username: clean }
      );

      if (createError) throw createError;

      profile = { username: clean };
    }

    currentUsername = profile.username;
    $('#onboarding').classList.add('hidden');

    await loadApp();
  } catch (error) {
    console.error(error);
    hideLoading();
    setHelp('#signInHelp', authErrorText(error), true);
    setInputError('#signInUsername', true);
    setInputError('#signInPassword', true);
    showAuthView('authSignIn');
  } finally {
    button.disabled = false;
    button.textContent = 'Sign in';
  }
}

createProfile = async function (username) {
  const clean = cleanUsername(username);
  const password = $('#signUpPassword').value;
  const confirmPassword = $('#confirmPassword').value;

  setHelp('#usernameHelp', '3–20 letters, numbers or underscores.');
  setHelp('#passwordHelp', 'Use at least 8 characters.');
  setHelp('#confirmHelp', '');
  ['#usernameInput', '#signUpPassword', '#confirmPassword'].forEach(id => setInputError(id, false));

  if (!validUsername(clean)) {
    setHelp('#usernameHelp', 'Use 3–20 letters, numbers or underscores.', true);
    setInputError('#usernameInput', true);
    return;
  }

  if (password.length < 8) {
    setHelp('#passwordHelp', 'Use at least 8 characters.', true);
    setInputError('#signUpPassword', true);
    return;
  }

  if (password !== confirmPassword) {
    setHelp('#confirmHelp', 'Passwords do not match.', true);
    setInputError('#confirmPassword', true);
    return;
  }

  const button = $('#signUpSubmit');
  button.disabled = true;
  button.textContent = 'Creating your list…';

  try {
    /*
      This small SECURITY DEFINER RPC lets signed-out visitors check only
      whether a username is available; it does not expose the profiles table.
    */
    const { data: available, error: availabilityError } = await db.rpc(
      'username_available',
      { chosen_username: clean }
    );

    if (availabilityError) {
      throw new Error('USERNAME_CHECK_UNAVAILABLE');
    }

    if (!available) {
      setHelp('#usernameHelp', 'That username is already taken. Try another.', true);
      setInputError('#usernameInput', true);
      return;
    }

    const { data, error } = await db.auth.signUp({
      email: usernameToEmail(clean),
      password,
      options: {
        data: { username: clean }
      }
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user returned from sign up.');

    currentUser = data.user;

    const { error: createError } = await db.rpc(
      'create_profile_and_list',
      { chosen_username: clean }
    );

    if (createError) throw createError;

    currentUsername = clean;
    hideLoading();
    showAuthView('authSuccess');
  } catch (error) {
    console.error(error);
    hideLoading();

    if (String(error?.message) === 'USERNAME_CHECK_UNAVAILABLE') {
      setHelp(
        '#usernameHelp',
        'Account setup is not ready yet. Run the username availability SQL in Supabase, then try again.',
        true
      );
    } else {
      const message = authErrorText(error);
      setHelp('#usernameHelp', message, true);
    }
  } finally {
    button.disabled = false;
    button.textContent = 'Create my list';
  }
};

async function signOutAccount() {
  showLoading('Signing out…');

  try {
    await db.auth.signOut();
  } finally {
    currentUser = null;
    currentUsername = null;
    state.goals = [];
    hideLoading();
    showAuthView('authLanding');
  }
}

function wireAuthUi() {
  $('#goSignIn').onclick = () => showAuthView('authSignIn');
  $('#goSignUp').onclick = () => showAuthView('authSignUp');
  $('#signInToSignUp').onclick = () => showAuthView('authSignUp');
  $('#signUpToSignIn').onclick = () => showAuthView('authSignIn');

  $$('[data-auth-back]').forEach(button => {
    button.onclick = () => showAuthView('authLanding');
  });

  $$('[data-toggle-password]').forEach(button => {
    button.onclick = () => {
      const input = $('#' + button.dataset.togglePassword);
      input.type = input.type === 'password' ? 'text' : 'password';
    };
  });

  $('#signInForm').onsubmit = event => {
    event.preventDefault();
    signInAccount(
      $('#signInUsername').value,
      $('#signInPassword').value
    );
  };

  /*
    app.js also knows about profileForm; replacing its handler here converts
    that existing hook from anonymous profile creation to real Auth signup.
  */
  $('#profileForm').onsubmit = event => {
    event.preventDefault();
    createProfile($('#usernameInput').value);
  };

  $('#authLetsGo').onclick = async () => {
    showLoading('Loading your 300…');
    await loadApp();
  };

  /* The old "start another profile" action becomes a genuine sign out. */
  $('#switchProfile').onclick = signOutAccount;
}

wireAuthUi();

/*
  Run our own session check as well as app.js's boot check. This makes the auth
  screen deterministic even if the two async initialisation paths finish in a
  different order on mobile Safari.
*/
(async function initialisePermanentAuth() {
  const { data: { session } } = await db.auth.getSession();

  if (!session?.user) {
    hideLoading();
    showAuthView('authLanding');
    return;
  }

  currentUser = session.user;

  const { data: profile } = await db
    .from('profiles')
    .select('username')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (profile?.username) {
    currentUsername = profile.username;
    return;
  }

  hideLoading();
  showAuthView('authSignIn');
})();
