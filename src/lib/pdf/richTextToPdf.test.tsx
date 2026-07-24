import { describe, it, expect } from 'vitest';
import { parseRichText } from '@/lib/pdf/richTextToPdf';

// The HTML here comes from RichTextEditor's execCommand output, which is
// browser-dependent and messy — so the parser has to be forgiving. It feeds
// the payment instructions block on every invoice PDF.

const textOf = (blocks: ReturnType<typeof parseRichText>) =>
  blocks.map((b) => b.runs.map((r) => r.text).join(''));

describe('parseRichText', () => {
  it('returns nothing for empty input', () => {
    expect(parseRichText(null)).toEqual([]);
    expect(parseRichText(undefined)).toEqual([]);
    expect(parseRichText('')).toEqual([]);
  });

  it('reads plain text as a single block', () => {
    expect(textOf(parseRichText('Wire to Account 1234'))).toEqual(['Wire to Account 1234']);
  });

  it('splits block-level elements into separate blocks', () => {
    expect(textOf(parseRichText('<div>First</div><div>Second</div>'))).toEqual(['First', 'Second']);
    expect(textOf(parseRichText('<p>One</p><p>Two</p>'))).toEqual(['One', 'Two']);
  });

  it('treats a line break as a block boundary', () => {
    expect(textOf(parseRichText('Line one<br>Line two'))).toEqual(['Line one', 'Line two']);
    expect(textOf(parseRichText('Line one<br />Line two'))).toEqual(['Line one', 'Line two']);
  });

  it('drops blocks that contain nothing at all', () => {
    expect(textOf(parseRichText('<div></div><div>Real</div>'))).toEqual(['Real']);
  });

  // A whitespace-only block is kept: it's how the editor represents a blank
  // line the user deliberately typed between paragraphs, and it renders as
  // vertical space in the PDF.
  it('keeps a whitespace-only block as deliberate spacing', () => {
    expect(textOf(parseRichText('<div>Real</div><div>   </div>'))).toEqual(['Real', '   ']);
  });

  it('marks bold and italic runs', () => {
    const [block] = parseRichText('Pay <b>immediately</b> on <i>receipt</i>');
    expect(block.runs).toEqual([
      { text: 'Pay ', bold: false, italic: false },
      { text: 'immediately', bold: true, italic: false },
      { text: ' on ', bold: false, italic: false },
      { text: 'receipt', bold: false, italic: true },
    ]);
  });

  it('accepts both <b>/<strong> and <i>/<em>', () => {
    expect(parseRichText('<strong>a</strong>')[0].runs[0].bold).toBe(true);
    expect(parseRichText('<em>a</em>')[0].runs[0].italic).toBe(true);
  });

  it('handles nested bold and italic', () => {
    const [block] = parseRichText('<b>bold <i>both</i></b>');
    expect(block.runs).toEqual([
      { text: 'bold ', bold: true, italic: false },
      { text: 'both', bold: true, italic: true },
    ]);
  });

  it('ignores attributes on formatting tags', () => {
    expect(parseRichText('<b style="color:red">x</b>')[0].runs[0].bold).toBe(true);
  });

  it('decodes the entities the editor emits', () => {
    expect(textOf(parseRichText('a&nbsp;b &amp; c &lt;d&gt; &quot;e&quot; &#39;f&#39;'))).toEqual([
      'a b & c <d> "e" \'f\'',
    ]);
  });

  it('flags list items so they can be bulleted', () => {
    const blocks = parseRichText('<ul><li>First</li><li>Second</li></ul>');
    expect(textOf(blocks)).toEqual(['First', 'Second']);
    expect(blocks.every((b) => b.listItem)).toBe(true);
  });

  it('does not flag ordinary paragraphs as list items', () => {
    expect(parseRichText('<div>Not a list</div>')[0].listItem).toBe(false);
  });

  it('handles a list mixed with prose', () => {
    const blocks = parseRichText('<div>Terms:</div><ul><li>Net 30</li></ul>');
    expect(textOf(blocks)).toEqual(['Terms:', 'Net 30']);
    expect(blocks[0].listItem).toBe(false);
    expect(blocks[1].listItem).toBe(true);
  });

  it('does not throw on unbalanced or unexpected markup', () => {
    for (const html of ['<b>unclosed', '</b>stray close', '<div><span>nested</span></div>', '<<>>']) {
      expect(() => parseRichText(html)).not.toThrow();
    }
  });
});
