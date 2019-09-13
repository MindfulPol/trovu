import Helper from "./helper.js";

/** Set and remember the environment. */
class Env {
  /**
   * Set helper variables.
   */
  constructor() {
    this.configUrlTemplate =
      "https://raw.githubusercontent.com/{%github}/trovu-data-user/master/config.yml";
    this.fetchUrlTemplateDefault =
      "https://raw.githubusercontent.com/trovu/trovu-data/master/shortcuts/{%namespace}/{%keyword}/{%argumentCount}.yml";
  }

  /**
   * Set the initial class environment vars either from params or from GET hash string.
   *
   * @param {array} [params] - List of parameters to be used in environment.
   */
  async populate(params) {
    if (!params) {
      params = this.getParams();
    }

    // TODO: Check for string and non-emptiness.
    if (params.github) {
      await this.setWithUserConfigFromGithub(params);
    }

    // Override all with params.
    Object.assign(this, params);

    this.setDefaults();
    this.addFetchUrlTemplateToNamespaces(params);
  }

  /**
   * Set default environment variables if they are still empty.
   */
  setDefaults() {
    // Default language.
    if (typeof this.language != "string") {
      this.language = this.getDefaultLanguage();
    }
    // Default country.
    if (typeof this.country != "string") {
      this.country = this.getDefaultCountry();
    }
    // Default namespaces.
    if (typeof this.namespaces != "object") {
      this.namespaces = ["o", this.language, "." + this.country];
    }
  }

  /**
   * Set the user configuration from their fork in their Github profile.
   *
   * @param {array} params - Here, 'github' and 'debug' will be used
   *
   * @return {boolean} [getUserConfigFailed] - True if fetch failed.
   */
  async setWithUserConfigFromGithub(params) {
    const { config, configUrl } = await this.getUserConfigFromGithub(params);
    if (config) {
      Object.assign(this, config);
    } else {
      alert("Failed to read Github config from " + configUrl);
    }
  }

  async getUserConfigFromGithub(params) {
    const configUrl = this.configUrlTemplate.replace("{%github}", params.github);
    const configYml = await Helper.fetchAsync(configUrl, false, params.debug);
    let config = false;
    if (configYml) {
      config = jsyaml.load(configYml);
    }
    return { config, configUrl };
  }

  // Param getters ====================================================

  /**
   * Get parameters from the URL query string.
   *
   * @return {array} params - List of found parameters.
   */
  getParams() {
    const paramStr = window.location.hash.substr(1);
    const params = Helper.jqueryDeparam(paramStr);
    return params;
  }

  /**
   * Get the default language and country from browser.
   *
   * @return {object} [language, country] - The default language and country.
   */
  getDefaultLanguageAndCountry() {
    let { language, country } = this.getLanguageAndCountryFromBrowser();

    // Set defaults.
    language = language || "en";
    country = country || "us";

    // Ensure lowercase.
    language = language.toLowerCase();
    country = country.toLowerCase();

    return { language, country };
  }

  /**
   * Get the default language and country from browser.
   *
   * @return {object} [language, country] - The default language and country.
   */
  getLanguageAndCountryFromBrowser() {
    const languageStr = navigator.language;
    let language, country;
    if (languageStr) {
      [language, country] = languageStr.split("-");
    }
    return { language, country };
  }

  /**
   * Get the default language.
   *
   * @return {string} language - The default language.
   */
  getDefaultLanguage() {
    const { language } = this.getDefaultLanguageAndCountry();
    return language;
  }

  /**
   * Get the default country.
   *
   * @return {string} language - The default country.
   */
  getDefaultCountry() {
    const { country } = this.getDefaultLanguageAndCountry();
    return country;
  }

  /**
   * To every namespace, add a fetch URL template.
   */
  addFetchUrlTemplateToNamespaces() {
    this.namespaces.forEach((namespace, i, namespaces) => {
      namespace = this.addFetchUrlTemplateToNamespace(namespace);
      namespaces[i] = namespace;
    });
  }

  /**
   * Add a fetch URL template to a namespace.
   * 
   * @param {(string|Object)} namespace - The namespace to add the URL template to.
   * 
   * @return {Object} namespace - The namespace with the added URL template.
   */
  addFetchUrlTemplateToNamespace(namespace) {
    if (typeof namespace == "string" && namespace.length < 4) {
      namespace = this.addFetchUrlTemplateToSiteNamespace(namespace);
    } else if (namespace.url && namespace.name) {
      // User namespaces may also have completely custom URL (template).
      // Must contain {%keyword} and {%argumentCount}.
      namespace.type = "user";
    } else if (namespace.github) {
      this.addFetchUrlTemplateToGithubNamespace(namespace);
    }
    // Yes, a string namespace with length < 4 will be ignored.
    return namespace;
  }

  /**
   * Add a URL template to a namespace that refers to a namespace in trovu-data.
   *
   * @param {string} name - The namespace name.
   */
  addFetchUrlTemplateToSiteNamespace(name) {
    const namespace = {
      name: name,
      type: "site",
      url:
        "https://raw.githubusercontent.com/trovu/trovu-data/master/shortcuts/" +
        name +
        "/{%keyword}/{%argumentCount}.yml"
    };
    return namespace;
  }

  /**
   * Add a URL template to a namespace that refers to a Github user repo.
   */
  addFetchUrlTemplateToGithubNamespace(namespace) {
    if (namespace.github == ".") {
      // Set to current user.
      namespace.github = this.github;
    }
    // Default name to Github name.
    if (!namespace.name) {
      namespace.name = namespace.github;
    }
    namespace.url =
      "https://raw.githubusercontent.com/" +
      namespace.github +
      "/trovu-data-user/master/shortcuts/{%keyword}.{%argumentCount}.yml";
    namespace.type = "user";
  }

  /**
   * Export current class without methods.
   *
   * @return {object} - Object of env without methods.
   */
  get withoutMethods() {
    const envWithoutFunctions = {};
    for (const key of Object.keys(this)) {
      if (typeof this[key] != "function") {
        envWithoutFunctions[key] = this[key];
      }
    }
    return envWithoutFunctions;
  }
}

export default Env;
