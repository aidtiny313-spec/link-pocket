'use strict';
const key = 'link-pocket.bookmarks.v1';
const get = (id) => document.getElementById(id);
const search = get('search');
const editor = get('editor');
const notice = get('notice');
const error = get('error');
let bookmarks = [];
let storageAvailable = true;
let editing = null;

function parseAddress(input) {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  try {
    const url = new URL(value.includes('://') ? value : 'https://' + value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

try {
  const saved = localStorage.getItem(key);
  if (saved !== null) {
    const entries = JSON.parse(saved);
    if (!Array.isArray(entries) || entries.some((item) =>
      !item || typeof item.id !== 'string' || typeof item.title !== 'string' ||
      typeof item.url !== 'string' || typeof item.favorite !== 'boolean' || !parseAddress(item.url))) {
      throw new Error('Invalid saved data');
    }
    bookmarks = entries;
  }
} catch {
  storageAvailable = false;
  get('add').disabled = true;
  notice.textContent = '저장된 링크를 불러올 수 없어요. Safari 또는 홈 화면에서 다시 열어보세요.';
  notice.hidden = false;
}

function save(next) {
  if (!storageAvailable) return false;
  try {
    localStorage.setItem(key, JSON.stringify(next));
    bookmarks = next;
    notice.hidden = true;
    render();
    return true;
  } catch {
    const message = editor.open ? error : notice;
    message.textContent = '이 기기에 링크를 저장하지 못했어요.';
    message.hidden = false;
    return false;
  }
}

function openEditor(item = null) {
  editing = item;
  get('editor-title').textContent = item ? '링크 수정' : '링크 추가';
  get('title').value = item?.title ?? '';
  get('address').value = item?.url ?? '';
  get('favorite').checked = item?.favorite ?? false;
  get('remove').hidden = !item;
  error.hidden = true;
  editor.showModal();
  get('address').focus();
}

function render() {
  const query = search.value.trim().toLocaleLowerCase();
  const matches = bookmarks.filter((item) =>
    item.title.toLocaleLowerCase().includes(query) || item.url.toLocaleLowerCase().includes(query));
  const list = get('links');
  list.replaceChildren();
  if (!storageAvailable) return;
  if (!matches.length) {
    const empty = document.createElement('section');
    empty.className = 'empty';
    const message = document.createElement('p');
    message.textContent = query ? '검색 결과가 없어요.' : '아직 저장한 링크가 없어요.';
    empty.append(message);
    list.append(empty);
    return;
  }

  for (const [heading, favorite] of [['즐겨찾기', true], ['저장한 링크', false]]) {
    const entries = matches.filter((item) => item.favorite === favorite);
    if (!entries.length) continue;
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = heading;
    section.append(title);
    for (const item of entries) {
      const row = get('row').content.cloneNode(true);
      const url = parseAddress(item.url);
      row.querySelector('a').href = url.href;
      row.querySelector('strong').textContent = item.title;
      row.querySelector('small').textContent = url.host;
      row.querySelector('.mark').textContent = item.title.trim().slice(0, 1) || '•';
      const star = row.querySelector('.star');
      star.textContent = item.favorite ? '★' : '☆';
      star.setAttribute('aria-label', item.title + ' 즐겨찾기');
      star.setAttribute('aria-pressed', String(item.favorite));
      star.onclick = () => save(bookmarks.map((entry) =>
        entry.id === item.id ? { ...entry, favorite: !entry.favorite } : entry));
      const edit = row.querySelector('.edit');
      edit.setAttribute('aria-label', item.title + ' 수정');
      edit.onclick = () => openEditor(item);
      section.append(row);
    }
    list.append(section);
  }
}

const remove = document.createElement('button');
remove.id = 'remove';
remove.type = 'button';
remove.className = 'danger';
remove.textContent = '삭제';
remove.onclick = () => {
  if (editing && confirm('이 링크를 삭제할까요?') &&
      save(bookmarks.filter((item) => item.id !== editing.id))) editor.close();
};
editor.querySelector('.actions').prepend(remove);
get('add').onclick = () => openEditor();
get('cancel').onclick = () => editor.close();
search.oninput = render;
get('form').onsubmit = (event) => {
  event.preventDefault();
  const url = parseAddress(get('address').value);
  if (!url) {
    error.textContent = '올바른 HTTP 또는 HTTPS 주소를 입력하세요.';
    error.hidden = false;
    get('address').focus();
    return;
  }
  const item = {
    id: editing?.id ?? crypto.randomUUID(),
    title: get('title').value.trim() || url.host,
    url: url.href,
    favorite: get('favorite').checked,
  };
  const next = editing ? bookmarks.map((entry) => entry.id === item.id ? item : entry) : [item, ...bookmarks];
  if (save(next)) editor.close();
};
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    if (notice.hidden) {
      notice.textContent = '오프라인 준비가 완료되지 않았어요. 온라인에서는 계속 사용할 수 있어요.';
      notice.hidden = false;
    }
  });
}
