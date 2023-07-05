export function validator(item, e, input, help, fx) {
  if (fx) {
    const value = e.target.value;
    if (!fx(value)) {
      help.innerHTML = item.error || 'Invalid';
      input.classList.remove('is-success');
      input.classList.add('is-danger');
      help.classList.add('is-danger');
    } else {
      help.innerHTML = '';
      help.classList.remove('is-danger');
      input.classList.remove('is-danger');
      input.classList.add('is-success');
    }
  }
}
