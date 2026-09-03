"use client";

import { ListItemNode, ListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  HEADING,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  UNORDERED_LIST,
  type Transformer,
} from "@lexical/markdown";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import {
  $createParagraphNode,
  $formatText,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type TextFormatType,
} from "lexical";
import { useEffect, useState } from "react";
import styles from "./story-notebook.module.css";

const markdownTransformers: Transformer[] = [
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
];

type Props = {
  documentId: string;
  locale: "pl" | "en";
  markdown: string;
  onChange(markdown: string): void;
};

function EditorToolbar({ locale }: { locale: "pl" | "en" }) {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const removeUndo = editor.registerCommand(CAN_UNDO_COMMAND, (value) => { setCanUndo(value); return false; }, COMMAND_PRIORITY_LOW);
    const removeRedo = editor.registerCommand(CAN_REDO_COMMAND, (value) => { setCanRedo(value); return false; }, COMMAND_PRIORITY_LOW);
    return () => { removeUndo(); removeRedo(); };
  }, [editor]);

  const keepSelection = (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault();
  const format = (value: TextFormatType) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, value);
  const block = (kind: "h1" | "h2" | "quote") => editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    $setBlocksType(selection, () => kind === "quote" ? $createQuoteNode() : $createHeadingNode(kind));
  });
  const paragraph = () => editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createParagraphNode());
  });
  const clearFormatting = () => editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    $setBlocksType(selection, () => $createParagraphNode());
    $formatText(selection, "bold", 0);
    $formatText(selection, "italic", 0);
    $formatText(selection, "strikethrough", 0);
  });
  const label = (pl: string, en: string) => locale === "pl" ? pl : en;

  return <div className={styles.formatBar} aria-label={label("Formatowanie notatki", "Note formatting")}>
    <button type="button" disabled={!canUndo} aria-label={label("Cofnij w notatce", "Undo in note")} title={label("Cofnij w notatce", "Undo in note")} onMouseDown={keepSelection} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>↶</button>
    <button type="button" disabled={!canRedo} aria-label={label("Ponów w notatce", "Redo in note")} title={label("Ponów w notatce", "Redo in note")} onMouseDown={keepSelection} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>↷</button>
    <span className={styles.formatDivider} aria-hidden="true"/>
    <button type="button" aria-label={label("Zwykły tekst", "Normal text")} title={label("Zmień akapit na zwykły tekst", "Turn the block into normal text")} onMouseDown={keepSelection} onClick={paragraph}>¶</button>
    <button type="button" title={label("Nagłówek 1", "Heading 1")} onMouseDown={keepSelection} onClick={() => block("h1")}>H1</button>
    <button type="button" title={label("Nagłówek 2", "Heading 2")} onMouseDown={keepSelection} onClick={() => block("h2")}>H2</button>
    <button type="button" title={label("Pogrubienie", "Bold")} onMouseDown={keepSelection} onClick={() => format("bold")}><b>B</b></button>
    <button type="button" title={label("Kursywa", "Italic")} onMouseDown={keepSelection} onClick={() => format("italic")}><i>I</i></button>
    <button type="button" title={label("Przekreślenie", "Strikethrough")} onMouseDown={keepSelection} onClick={() => format("strikethrough")}><s>S</s></button>
    <button type="button" aria-label={label("Usuń formatowanie", "Clear formatting")} title={label("Zmień na zwykły tekst i usuń style", "Turn into normal text and remove styles")} onMouseDown={keepSelection} onClick={clearFormatting}>Tx</button>
    <button type="button" title={label("Cytat", "Quote")} onMouseDown={keepSelection} onClick={() => block("quote")}>❯</button>
    <button type="button" title={label("Lista punktowana", "Bulleted list")} onMouseDown={keepSelection} onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>•</button>
    <button type="button" title={label("Lista numerowana", "Numbered list")} onMouseDown={keepSelection} onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}>1.</button>
  </div>;
}

export function StoryNotebookRichEditor({ documentId, locale, markdown, onChange }: Props) {
  const label = locale === "pl" ? "Treść notatki" : "Note content";
  return <div className={styles.editorShell}>
    <LexicalComposer initialConfig={{
      namespace: `story-notebook-${documentId}`,
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode],
      editorState: () => $convertFromMarkdownString(markdown, markdownTransformers),
      onError: (error) => { throw error; },
      theme: {
        heading: { h1: styles.editorHeadingOne, h2: styles.editorHeadingTwo },
        list: { listitem: styles.editorListItem, ol: styles.editorOrderedList, ul: styles.editorUnorderedList },
        quote: styles.editorQuote,
        text: { bold: styles.editorBold, italic: styles.editorItalic, strikethrough: styles.editorStrikethrough },
      },
    }}>
      <EditorToolbar locale={locale}/>
      <div className={styles.editorFrame}>
        <RichTextPlugin
          contentEditable={<ContentEditable className={styles.editor} aria-label={label} spellCheck/>}
          placeholder={<div className={styles.editorPlaceholder}>{locale === "pl" ? "Zacznij pisać…" : "Start writing…"}</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <HistoryPlugin/>
      <MarkdownShortcutPlugin transformers={markdownTransformers}/>
      <OnChangePlugin ignoreSelectionChange onChange={(state) => state.read(() => {
        const next = $convertToMarkdownString(markdownTransformers);
        if (next !== markdown) onChange(next);
      })}/>
    </LexicalComposer>
  </div>;
}
