export function modalTarget(target) {
  const peer_target = target.getAttribute('modalpeer');
  let peer_tabs = Array.from(document.querySelectorAll('.modalPeer'));
  peer_tabs.forEach((peer) => peer.classList.remove('is-active'));
  target.classList.add('is-active');
  const modalpeers = Array.from(document.querySelectorAll('.modalpeer'));
  modalpeers.forEach((peer) => (peer.style.display = peer.classList.contains(peer_target) ? 'inline' : 'none'));
}
