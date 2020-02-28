export {};

declare global {
	namespace NodeJS {
		interface Global {
		  /**
		   * I18n localization function. Returns localized string.
		   * If no translation is avaible at current selected language, then fallback to
		   * default language, if still no translation exists, original text is returned
		   *
		   * @param text { string } - text to localize.
		   * @param locale { string } - selected locale, if not specified - default locale is selected
		   */
		  __(text: string, locale?: string): string;
	  
		  /**
		   * Plurals translation of a single phrase. Singular and plural forms will get added to locales if unknown.
		   * Returns translated parsed and substituted string based on last count parameter.
		   *
		   * @param text { string } - text to localize
		   * @param count { number } - number of items/things
		   * @example use like `__n("%s cats", 1) returns `1 cat`
		   */
		  __n(text: string, count: Number): string;
	  
		  /**
		   * Returns a list of translations for a given phrase in each language.
		   *
		   * @param text { string } - text to translate
		   */
		  __l(text: string): string[];
	  
		  /**
		   * Returns a hashed list of translations for a given phrase in each language.
		   *
		   * @param text { string } - text to translate
		   */
		  __h(text: string): any[];
		}
	  }
	  
	  interface PhraseWithOptions {
		phrase: string;
		locale: string;
	  }
	  
	  /**
	   * I18n localization function. Returns localized string.
	   * If no translation is avaible at current selected language, then fallback to
	   * default language, if still no translation exists, original text is returned
	   *
	   * @param text { string } - text to localize.
	   * @param locale { string } - selected locale, if not specified - default locale is selected
	   */
	  function __(text: string | PhraseWithOptions, ...args: any[]): string;
	  
	  /**
	   * Plurals translation of a single phrase. Singular and plural forms will get added to locales if unknown.
	   * Returns translated parsed and substituted string based on last count parameter.
	   *
	   * @param text { string } - text to localize
	   * @param count { number } - number of items/things
	   * @example use like `__n("%s cats", 1) returns `1 cat`
	   */
	  function __n(text: string, count: Number): string;
	  
	  /**
	   * Returns a list of translations for a given phrase in each language.
	   *
	   * @param text { string } - text to translate
	   */
	  function __l(text: string): string[];
	  
	  /**
	   * Returns a hashed list of translations for a given phrase in each language.
	   *
	   * @param text { string } - text to translate
	   */
	  function __h(text: string): any[];
}
  