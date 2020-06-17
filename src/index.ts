import { IContainer, Injectable, SyncModule, Autoinject, DI } from "@spinajs/di";
import { Configuration } from '@spinajs/configuration';
import { Log, Logger } from "@spinajs/log";
import { InvalidArgument } from "@spinajs/exceptions";

import * as fs from 'fs';
import * as glob from 'glob';
import * as _ from 'lodash';
import { normalize, resolve, basename } from 'path';
import * as util from 'util';
import * as MakePlural from 'make-plural';
import * as InvervalParser from 'math-interval-parser';
 
const globalAny:any = global;

export interface IPhraseWithOptions {
    phrase: string;
    locale: string;
}

export abstract class Intl extends SyncModule {

    /**
     * Currently selected locale
     */
    public CurrentLocale: string;

    /**
     * Map with avaible translations, keyed by locale name
     */
    public Locales = new Map<string, any>();

    /**
     * I18n localization function. Returns localized string.
     * If no translation is avaible at current selected language, then fallback to
     * default language, if still no translation exists, original text is returned
     *
     * @param text { string | IPhraseWithOptions } - text to localize.
     * @param args { any[] } - argument passed to formatted text
     */
    public abstract __(text: string | IPhraseWithOptions, ...args: any[]): string;

    /**
     * Plurals translation of a single phrase. Singular and plural forms will get added to locales if unknown.
     * Returns translated parsed and substituted string based on last count parameter.
     *
     * @param text { string } - text to localize
     * @param count { number } - number of items/things
     * @example use like `__n("%s cats", 1) returns `1 cat`
     */
    public abstract __n(text: string | IPhraseWithOptions, count: number): string;

    /**
     * Returns a list of translations for a given phrase in each language.
     *
     * @param text { string } - text to translate
     */
    public abstract __l(text: string): string[];

    /**
     * Returns a hashed list of translations for a given phrase in each language.
     *
     * @param text { string } - text to translate
     */
    public abstract __h(text: string): any[];



}

/**
 * Basic internationalization support. Text phrases are read from json files specified 
 * in system.dirs.locales
 */
@Injectable(Intl)
export class SpineJsInternationalizationFromJson extends Intl {

    /**
     * Currently selected locale
     */
    public get CurrentLocale() {
        return this._currentLocale;
    }

    /**
     * Currently selected locale
     */
    public set CurrentLocale(value: string) {

        if (!value) {
            throw new InvalidArgument("value cannot be empty or null");
        }

        this._currentLocale = value;
    }

    /**
     * Map with avaible translations, keyed by locale name
     */
    public Locales = new Map<string, any>();

    /**
     * Logger for this module
     */
    @Logger({ module: 'Locales' })
    protected Log: Log;

    @Autoinject()
    protected Configuration: Configuration;

    // tslint:disable-next-line: variable-name
    private _currentLocale: string;


    // tslint:disable-next-line: variable-name
    public resolve(_c: IContainer): void {

        this.CurrentLocale = this.Configuration.get("intl.defaultLocale", "en");

        const localeDirs = this.Configuration.get("system.dirs.locales", []);

        localeDirs.filter(d => fs.existsSync(d))
            .map(d => glob.sync(`${d}/**/*.json`))
            .reduce((prev, current) => {
                return prev.concat(_.flattenDeep(current))
            }, [])
            .map(f => normalize(resolve(f)))
            .map(f => {
                this.Log.trace(`Found localisation file at ${f}`);
                return f;
            })
            .forEach(f => {
                const lang = basename(f, '.json');
                let data;

                try {
                    data = JSON.parse(fs.readFileSync(f, "utf-8"));
                } catch (ex) {
                    this.Log.warn(ex, `Cannot load localisation data from file ${f} for lang ${lang}`);
                    return;
                }

                if (!data) {
                    this.Log.warn(`No localisation data at ${f} for lang ${lang}`);
                    return;
                }

                this.Locales.set(lang, _.merge(data, this.Locales.get(lang) && {}));
            });
    }

    /**
     * I18n localization function. Returns localized string.
     * If no translation is avaible at current selected language, then fallback to
     * default language, if still no translation exists, original text is returned
     *
     * @param text { string | IPhraseWithOptions } - text to localize.
     * @param args { any[] } - argument passed to formatted text
     */
    public __(text: string | IPhraseWithOptions, ...args: any[]): string {

        let locTable;
        let toLocalize;

        if (_.isString(text)) {
            locTable = this.Locales.get(this.CurrentLocale);
            toLocalize = text;
        } else {
            locTable = this.Locales.get(text.locale) ?? this.Locales.get(this.CurrentLocale);
            toLocalize = text.phrase;
        }

        if (!locTable) {
            return util.format(toLocalize, ...args);
        }

        return util.format(locTable[toLocalize] ?? toLocalize, ...args);
    }

    /**
     * Plurals translation of a single phrase.
     * Returns translated, parsed and substituted string based on count parameter.
     *
     * @param text { string } - text to localize
     * @param count { number } - number of items/things
     * @example use like `__n("%s cats", 1) returns `1 cat`
     */
    public __n(text: string | IPhraseWithOptions, count: number): string {

        let locTable;
        let toLocalize;
        let locale;

        if (_.isString(text)) {
            locale = this.CurrentLocale;
            locTable = this.Locales.get(this.CurrentLocale);
            toLocalize = text;
        } else {
            locale = text.locale ?? this.CurrentLocale;
            locTable = this.Locales.get(text.locale) ?? this.Locales.get(this.CurrentLocale);
            toLocalize = text.phrase;
        }

        if (/%/.test(toLocalize) && this.Locales.has(locale)) {
            const phrase = locTable[toLocalize];
            const pluralVerb = MakePlural[locale](count);

            if (phrase[pluralVerb]) {
                return util.format(phrase[pluralVerb], count);
            } else if (phrase.other) {
                return util.format(_getInterval(phrase.other, count), count);
            }

            return this.__(text, count);
        }

        return this.__(text, count);

        function _getInterval(text: string, count: number) {
            let toReturn = text;
            const phrases = text.split(/\|/);

            phrases.some(phrase => {
                const matches = phrase.match(/^\s*([\(\)\[\]\d,]+)?\s*(.*)$/);

                if (matches[1] && _matchInterval(count, matches[1])) {
                    toReturn = matches[2];
                    return true;
                } else {
                    toReturn = phrase;
                }
            });

            return toReturn;

            /**
             * test a number to match mathematical interval expressions
             * [0,2] - 0 to 2 (including, matches: 0, 1, 2)
             * ]0,3[ - 0 to 3 (excluding, matches: 1, 2)
             * [1]   - 1 (matches: 1)
             * [20,] - all numbers ≥20 (matches: 20, 21, 22, ...)
             * [,20] - all numbers ≤20 (matches: 20, 21, 22, ...)
             */
            function _matchInterval(c: number, eq: string) {
                const interval = InvervalParser.default(eq);
                if (interval) {
                    if (interval.from.value === c) {
                        return interval.from.included;
                    }

                    if (interval.to.value === c) {
                        return interval.from.included;
                    }

                    return (
                        Math.min(interval.from.value, c) === interval.from.value && Math.max(interval.to.value, c) === interval.to.value
                    );
                }

                return false;
            }
        }
    }

    /**
     * Returns a list of translations for a given phrase in each language.
     *
     * @param text { string } - text to translate
     */
    public __l(text: string): string[] {

        const extract = _.property(text);

        return Array.from(this.Locales.values()).map((v) => {
            return extract(v) as string;
        });
    }


    /**
     * Returns a hashed list of translations for a given phrase in each language.
     *
     * @param text { string } - text to translate
     */
    public __h(text: string): any[] {

        const extract = _.property(text);

        return Array.from(this.Locales.values()).map((v, locale) => {
            return { [locale]: extract(v) };
        });
    }
}

/**
 * I18n localization function. Returns localized string.
 * If no translation is avaible at current selected language, then fallback to
 * default language, if still no translation exists, original text is returned
 *
 * @param text { string } - text to localize.
 * @param locale { string } - selected locale, if not specified - default locale is selected
 */
globalAny.__ = (text: string | IPhraseWithOptions, ...args: any[]) => {
    return DI.get<Intl>(Intl).__(text, ...args);
};

/**
 * Plurals translation of a single phrase. Singular and plural forms will get added to locales if unknown.
 * Returns translated parsed and substituted string based on last count parameter.
 *
 * @param text { string } - text to localize
 * @param count { number } - number of items/things
 * @example use like `__n("%s cats", 1) returns `1 cat`
 */
globalAny.__n = (text: string | IPhraseWithOptions, count: number) => {
    return DI.get<Intl>(Intl).__n(text, count);
};

/**
 * Returns a list of translations for a given phrase in each language.
 *
 * @param text { string } - text to translate
 */
globalAny.__l = (text: string) => {
    return DI.get<Intl>(Intl).__l(text);
};

/**
 * Returns a hashed list of translations for a given phrase in each language.
 *
 * @param text { string } - text to translate
 */
globalAny.__h = (text: string) => {
    return DI.get<Intl>(Intl).__h(text);
};