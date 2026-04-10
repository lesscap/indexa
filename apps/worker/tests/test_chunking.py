from indexa_worker.chunking import Chunk, resolve_chunk_config, split_text


def test_split_text_empty_input_returns_nothing():
  assert split_text('') == []
  assert split_text('   \n\n   ') == []


def test_split_text_small_input_returns_single_chunk():
  text = 'short document content'
  chunks = split_text(text, chunk_size=200, chunk_overlap=20)
  assert len(chunks) == 1
  assert chunks[0].chunk_no == 0
  assert chunks[0].text == text
  assert chunks[0].char_count == len(text)


def test_split_text_long_input_produces_sequential_chunks():
  text = ('para ' * 400).strip()
  chunks = split_text(text, chunk_size=400, chunk_overlap=50)
  assert len(chunks) >= 2
  assert [c.chunk_no for c in chunks] == list(range(len(chunks)))
  assert all(isinstance(c, Chunk) for c in chunks)


def test_split_text_content_hash_is_stable():
  text = 'hash stability check'
  a = split_text(text)[0]
  b = split_text(text)[0]
  assert a.content_hash == b.content_hash
  assert len(a.content_hash) == 64


def test_resolve_chunk_config_defaults():
  assert resolve_chunk_config(None) == (800, 120)
  assert resolve_chunk_config({}) == (800, 120)


def test_resolve_chunk_config_overrides():
  assert resolve_chunk_config({'chunk_size': 500, 'chunk_overlap': 50}) == (500, 50)
