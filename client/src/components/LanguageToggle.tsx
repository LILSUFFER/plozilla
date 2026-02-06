import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export function LanguageToggle() {
  const { lang, setLang } = useTranslation();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
      className="font-mono text-xs px-2"
      data-testid="button-lang-toggle"
    >
      {lang === 'en' ? 'RU' : 'EN'}
    </Button>
  );
}
