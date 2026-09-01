"use client";
import type { MouseEvent } from "react";
import type { EditorLocale } from "../i18n/workbench-copy";
import { legalMarginaliaCopy, type LegalMarginaliaSection } from "./legal-marginalia-copy";
import styles from "./global-legal-footer.module.css";

type GlobalLegalFooterProps = {
  locale: EditorLocale;
  onOpenMarginalia: (section: LegalMarginaliaSection) => void;
};

export function GlobalLegalFooter({ locale, onOpenMarginalia }: GlobalLegalFooterProps) {
  const copy = legalMarginaliaCopy[locale].footer;
  const open = (section: LegalMarginaliaSection) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onOpenMarginalia(section);
  };
  return <footer className={styles.footer} aria-label={copy.ariaLabel}>
    <span aria-hidden="true">✦</span>
    <nav aria-label={copy.ariaLabel}>
      <a href="#marginalia-privacy" onClick={open("privacy")}>{copy.privacy}</a>
      <a href="#marginalia-terms" onClick={open("terms")}>{copy.terms}</a>
      <a href="#marginalia-legal" onClick={open("legal")}>{copy.licences}</a>
      <a href="mailto:varera.contact@gmail.com">{copy.contact}</a>
    </nav>
  </footer>;
}
