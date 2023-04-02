// Helper scripts for managing shortcuts in https://github.com/trovu/trovu-data/.

const actions = {};
const fs = require('fs');
const isValidDomain = require('is-valid-domain');
const jsyaml = require('js-yaml');
const languages = require('@cospired/i18n-iso-languages');
const modifiers = {};

import UrlProcessor from './modules/UrlProcessor';

let ymlDirPath;

async function main() {
  if (process.argv.length < 3) {
    console.log('Usage: node index.js action [path]');
    return;
  }

  if (!process.env.TROVU_DATA_PATH) {
    console.log(
      'Environment variable TROVU_DATA_PATH must contain full path to trovu-data directory. Pleas set with:',
    );
    console.log('export TROVU_DATA_PATH=/path/to/trovu-data');
    return;
  }
  ymlDirPath = process.env.TROVU_DATA_PATH;

  const action = process.argv[2];
  if (action in actions) {
    actions[action]();
  } else {
    console.log('Action must be one of: ', Object.keys(actions));
  }
}

function loadYmls() {
  const ymls = {};
  const ymlFileNames = fs.readdirSync(ymlDirPath);
  for (const ymlFileName of ymlFileNames) {
    const ymlFilePath = ymlDirPath + ymlFileName;
    const ymlStr = fs.readFileSync(ymlFilePath, 'utf8');
    const shortcuts = jsyaml.load(ymlStr);
    ymls[ymlFileName] = shortcuts;
  }
  return ymls;
}

function writeYmls(ymls) {
  for (const ymlFileName in ymls) {
    const ymlFilePath = ymlDirPath + ymlFileName;
    const yml = ymls[ymlFileName];
    const ymlSorted = sortObject(yml);
    for (const shortcut of Object.values(yml)) {
      if (shortcut.tags) shortcut.tags.sort();
    }
    // TODO:
    // trim strings: - keys - titles - examples - description
    // make sure, subkeys are in reverse particular order: url, post_params, description, tags, examples
    const ymlStr = jsyaml.dump(ymlSorted, {
      noArrayIndent: true,
      lineWidth: -1,
    });
    fs.writeFileSync(ymlFilePath, ymlStr);
  }
  return ymls;
}

actions['normalize'] = async function () {
  const ymls = loadYmls();
  writeYmls(ymls);
};

function sortObject(obj) {
  return Object.keys(obj)
    .sort()
    .reduce(function (result, key) {
      result[key] = obj[key];
      return result;
    }, {});
}

const isValidUrl = (urlString) => {
  try {
    return Boolean(new URL(urlString));
  } catch (e) {
    return false;
  }
};

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 5000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetch(resource, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      },
    });
  } catch (e) {
    return { status: 500 };
  }
  clearTimeout(id);
  return response;
}

actions['testFetch'] = async function () {
  const response = await fetchWithTimeout(process.argv[3]);
  console.log(response);
};

actions['listKeys'] = async function () {
  const ymlsAll = loadYmls();
  const ymls = {};
  const ymlFileName = process.argv[3] + '.yml';
  ymls[ymlFileName] = ymlsAll[ymlFileName];
  for (const ymlFilePath in ymls) {
    const yml = ymls[ymlFilePath];
    for (const key in yml) {
      console.log(key);
    }
  }
};

actions['applyModifier'] = async function () {
  const ymlsAll = loadYmls();
  const ymls = {};
  const ymlFileName = `${process.argv[4].trim()}.yml`;
  ymls[ymlFileName] = ymlsAll[ymlFileName];
  for (const ymlFilePath in ymls) {
    const yml = ymls[ymlFilePath];
    for (const key in yml) {
      let shortcut = yml[key];
      shortcut = await modifiers[process.argv[3].trim()](key, shortcut);
      if (!shortcut) {
        delete yml[key];
      }
    }
  }
  writeYmls(ymls);
  console.log('Done');
};

modifiers['addTagOld'] = async function (key, shortcut) {
  if (!shortcut.tags) {
    shortcut.tags = [];
  }
  shortcut.tags.push('old');
  return shortcut;
};

modifiers['removeYahooCurrencyConverters'] = async function (key, shortcut) {
  if (shortcut.title.search(new RegExp('^Convert .*Yahoo.$')) > -1) {
    console.log('Removing ', shortcut.title);
    return false;
  }
  return shortcut;
};

modifiers['removeGoogleMapsCities'] = async function (key, shortcut) {
  if (
    key.search(new RegExp('^gm.+')) > -1 &&
    !key.match(new RegExp('^gm(b|hh|m|k|f|s|d|l|do|e|hb|dd|h|n|du) 1'))
  ) {
    console.log('Removing', shortcut.title);
    return false;
  }
  return shortcut;
};

modifiers['deprecateGoogleMapsCities'] = async function (key, shortcut) {
  let matches;
  if ((matches = key.match(new RegExp('^gm(.+) ')))) {
    const city = matches[1];
    console.log('Deprecating', shortcut.title);
    shortcut.deprecated = {
      alternative: {
        query: `gm ${city},{%1}`,
      },
      created: '2023-01-07',
    };
    console.log(shortcut);
  }
  return shortcut;
};

modifiers['removeDeadDomains'] = async function (key, shortcut) {
  const skipDomains = [
    'colourlovers.com',
    'iafd.com',
    'tcodesearch.com',
    'debian.org',
    'reddit.com',
  ];
  for (const skipDomain of skipDomains) {
    if (shortcut.url.search(new RegExp(skipDomain, 'i')) > -1) {
      console.log('Skipping listed domain:', shortcut.url);
      return shortcut;
    }
  }
  if (!isValidUrl(shortcut.url)) {
    console.log('Skipping invalid URL:', shortcut.url);
    return shortcut;
  }
  const url = new URL(shortcut.url);
  if (!isValidDomain(url.hostname)) {
    console.log('Skipping invalid hostname:', url.host);
    return shortcut;
  }
  // console.log(url.host);
  const testUrl = url.protocol + '//' + url.host;
  try {
    // console.log(testUrl, "...");
    const response = await fetchWithTimeout(testUrl);
    if (response.status != 200) {
      console.log(response.status, testUrl);
      return false;
    }
  } catch (error) {
    console.log(url.host);
    console.error(error);
    return false;
  }
  return shortcut;
};

modifiers['checkShortcutResponse'] = async function (key, shortcut) {
  if (shortcut.deprecated) {
    return shortcut;
  }
  // Only letter a for now.
  if (!key[0].match(/[^a-z]/)) {
    //return shortcut;
  }
  let url = shortcut.url;
  const args = ['foo', 'bar', 'baz', 'a', 'b', 'c'];
  const env = { language: 'de', country: 'de' };
  url = await UrlProcessor.replaceArguments(url, args, env);
  url = await UrlProcessor.replaceVariables(url, env);
  console.log(key);
  const response = await fetchWithTimeout(url);
  if (response.status != 200) {
    console.log(response.status, url);
  }
  return shortcut;
};

actions['createDictionaryInfo'] = async function () {
  const t = jsyaml.load(fs.readFileSync('src/yml/translations.yml', 'utf8'));
  const dicts = jsyaml.load(
    fs.readFileSync('src/yml/dictionaries.yml', 'utf8'),
  );
  const dict = process.argv[3];

  for (const lang1 in dicts[dict].pairs) {
    for (const lang2 in dicts[dict].pairs[lang1]) {
      if (!languages.getName(lang1, lang2)) {
        console.log(`Missing code for ${lang1}-${lang2}`);
        return;
      }
      if (!t.tree[lang1]) {
        console.log(`Missing tree for ${lang1}`);
        return;
      }
      if (!t.tree[lang2]) {
        console.log(`Missing tree for ${lang2}`);
        return;
      }
      logKey(lang1, lang2, 0);
      logUrl(lang1, lang2, 0);
      logTitle(lang1, lang2);
      logTags(lang1, lang2);

      logKey(lang1, lang2, 1);
      logUrl(lang1, lang2, 1);
      logTitle(lang1, lang2);
      logTags(lang1, lang2);
      logExamples(lang1, lang2);

      logKey(lang2, lang1, 0);
      logTitle(lang2, lang1);
      logInclude(lang2, lang1, 0);

      logKey(lang2, lang1, 1);
      logTitle(lang2, lang1);
      logInclude(lang2, lang1, 1);
      logExamples(lang2, lang1);
    }
  }

  function logKey(lang1, lang2, argumentCount) {
    console.log(`${lang1}-${lang2} ${argumentCount}:`);
  }
  function logInclude(lang1, lang2, argumentCount) {
    console.log(`  include:`);
    console.log(`    key: ${lang2}-${lang1} ${argumentCount}`);
  }
  function logUrl(lang1, lang2, argumentCount) {
    console.log(`  url: ${dicts[dict].pairs[lang1][lang2][argumentCount]}`);
  }
  function logTitle(lang1, lang2) {
    console.log(
      '  title:',
      `${capitalize(languages.getName(lang1, lang2))}-${capitalize(
        languages.getName(lang2, lang2),
      )} (${dicts[dict].name})`,
    );
  }
  function logTags(lang1, lang2) {
    console.log('  tags:');
    console.log('  - dictionary');
    console.log('  - language');
    console.log(`  - ${anticapitalize(languages.getName(lang1, 'en'))}`);
    console.log(`  - ${anticapitalize(languages.getName(lang2, 'en'))}`);
  }
  function logExamples(lang1, lang2) {
    console.log('  examples:');
    console.log(
      '   ',
      `${t.tree[lang1]}: ${t.desc[lang2]
        .replace('{lang}', languages.getName(lang2, lang2))
        .replace('{tree}', t.tree[lang1])}`,
    );
    console.log(
      '   ',
      `${t.tree[lang2]}: ${t.desc[lang2]
        .replace('{lang}', languages.getName(lang1, lang2))
        .replace('{tree}', t.tree[lang2])}`,
    );
  }
  function capitalize(str) {
    const capitalized = str.charAt(0).toUpperCase() + str.slice(1);
    return capitalized;
  }
  function anticapitalize(str) {
    const capitalized = str.charAt(0).toLowerCase() + str.slice(1);
    return capitalized;
  }
};

main();
