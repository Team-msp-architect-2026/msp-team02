import styles from './SkipLink.module.css';

interface SkipLinkTarget {
  href: string;
  label: string;
}

interface SkipLinkProps {
  links?: SkipLinkTarget[];
}

const defaultLinks: SkipLinkTarget[] = [
  { href: '#main-content', label: '본문으로 건너뛰기' },
];

export function SkipLink({ links = defaultLinks }: SkipLinkProps) {
  return (
    <nav className={styles.skipLinks} aria-label="건너뛰기 링크">
      {links.map((link) => (
        <a key={link.href} className={styles.link} href={link.href}>
          {link.label}
        </a>
      ))}
    </nav>
  );
}
