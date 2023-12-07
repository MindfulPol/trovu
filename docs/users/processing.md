# How a query is processed

The purpose of a query is to match with a shortcut. And shortcuts are organized by [Namespaces](../shortcuts/namespaces.md): Every shortcut belongs exactly to one namespace.

## Namespace setting

When calling Trovu without query parameters, 3 default namespaces will be set based on the browser's language settings. For instance, if the browser's language is `de-DE`, we will use these namespaces and their shortcut files:

-   [o.yml](https://github.com/trovu/trovu/tree/master/data/shortcuts/o.yml) – planet namespace
-   [de.yml](https://github.com/trovu/trovu/tree/master/data/shortcuts/de.yml) – German language namespace
-   [.de.yml](https://github.com/trovu/trovu/tree/master/data/shortcuts/.de.yml) – Germany namespace

## Processing a query

Now, let's look at the processing of a query:

1. A query comes in, e.g. `g foobar`.
1. The current namespace setting is `o,de,.de`.
1. Given the namespaces, all the shortcuts are fetched from their YAML files into a JavaScript variable in the client.

    - The fetch() call checks also if the files are already in the browser cache, and only requests them from remote if they are not cached yet.
    - To reload the shortcuts, use the `reload` command (see below).

1. The query is parsed – in the client by JavaScript – into
    - keyword: `g`
    - argument: `foobar`
1. Based on the query and the namespace settings, the loaded shortcuts are searched whether they match a query with the keyword `g` and one argument, i.e. if they contain a shortcut keyed with `g 1`.
1. We find 2 matches:
    - one in [o](https://github.com/trovu/trovu/tree/master/data/shortcuts/o.yml), pointing to `google.com`
    - and one in [.de](https://github.com/trovu/trovu/tree/master/data/shortcuts/.de.yml), pointing to `google.de`
1. From the found matches, the results are evaluated in namespace order.
1. Since namespace `.de` has higher priority than `o`, its URL is used for further processing
    - `https://www.google.de/search?hl=<$language>&q=<query>&ie=utf-8`
1. The `<$language>` placeholder is being replaced with the variable `de`.
1. The `<query>` placeholder is being replaced with the query argument `foobar`.
1. A redirect to the URL is made.

## Reloading shortcuts

Since shortcuts are cached in the browser cache, you may want to reload them once they got updated. Do so by

-   either prefixing a query: `reload:g foobar`
-   or only calling `reload`.