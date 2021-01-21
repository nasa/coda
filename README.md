# CODA

_Collaborative Operations Data Activation_

Consolidating the context of missions, training, and testing into an easy to use platform to relive and revisit each moment. For more info, see https://wiki.jsc.nasa.gov/exploration/index.php/CODA.

## Development

This section is only necessary if you're working with the CODA codebase.

### Your Code Editor

You probably want to use [VSCode](https://code.visualstudio.com/). It provides the best-in-class IDE experience when working with TypeScript.

### Software Dependencies

- [NodeJS](https://nodejs.dev/) v14. Install manually or use [`nvm`](https://github.com/nvm-sh/nvm) (Mac/Linux) or [`nvm-windows`](https://github.com/coreybutler/nvm-windows) (Windows)

### First Time Installation

1. If you're using `nvm` instead of installing Node manually, install the right version of Node: `nvm install && nvm use`
  - `nvm-windows` does not recognize `.nvmrc` files, so if you're using Git Bash you can do `nvm install $(cat .nvmrc) && nvm use $(cat .nvmrc)`
2. Install JavaScript dependencies: `npm i`
3. (Optional) Change your hosts file to map `coda-iss.develop` to `127.0.0.1`.
4. Create a `.env` file at the root of the repo. It must contain:

```
IO_KEY="the-auth-key-we-have-for-io"
WIKI_USER="the-wiki-bot-account-username"
WIKI_PASSWORD="and-the-associated-password"
```

Ask Ben or Cameron for the key if you don't have it.

### Dev Server

`npm run dev`

Then head over to `http://coda-iss.develop:3000` (or `http://localhost:3000` if you didn't setup your hosts file)

Bonus: `npm run dev` is already setup to work with [VS Code's debugger](https://code.visualstudio.com/docs/editor/debugging). Once the dev server is up and running, just F5 to attach to it (assuming you haven't changed the default keybindings). You should be able to set breakpoints and inspect code execution.

Here's the [documentation](https://nextjs.org/docs/advanced-features/debugging) on how the debugger is setup.

### Run Tests

We use [Jest](https://jestjs.io/en/) to run tests and [Enzyme](https://enzymejs.github.io/enzyme/) to setup tests against React components.

- [Documentation on Jest matchers](https://jestjs.io/docs/en/using-matchers), eg. the syntax of `expect(foo).toEqual(bar)`

Run tests with:

```sh
npm t
```

### How to Work with this Repo

CODA is written in JavaScript and [TypeScript](https://www.typescriptlang.org/). TypeScript is a superset of JavaScript. The two can be used interchangeably in the project simply by swapping a `.js` for a `.ts` extension. The main benefit of using TypeScript over JavaScript is the addition of strong types.

CODA primarily relies on two libraries:

1. [React](https://reactjs.org/) - for structuring the front-end components
2. [NextJS](https://nextjs.org/) - for building the actual HTML, CSS, and JS files that get sent to browser clients

There is too much to cover about React here. We highly recommend going through [their tutorial](https://reactjs.org/tutorial/tutorial.html) to get a feel for it. This repo tries to stay as close to idiomatic React as possible. We use the latest version and emphasize functional components that return [JSX](https://reactjs.org/docs/introducing-jsx.html) (HTML in JS).

NextJS provides a framework for laying out files in a project. It takes a highly opinionated position on how the project should be structured. In doing so, it takes responsibility for turning our React code into static HTML, JS, and CSS code that correspond to the pages of our website. At the same, NextJS encourages patterns that let it prepopulate data and perform static rendering of the website. This makes the end site feel faster to users because they don't have to wait for additional requests to finish before seeing information appear on the page.

If you're trying to debug something, here's a good general rule of thumb about where to look:

- Are you looking at something weird inside a function the returns JSX? It's probably a React thing.
- Are you looking at something weird about a filename or directory name? It's probably a NextJS thing.
- Are you looking at code that looks like JavaScript but not really? It's probably a TypeScript thing.

### Notable, Non-Standard Configuration Files

- `.nvmrc` - defines the version of Node we're using
- `next-env.d.ts` - TypeScript definition file for NextJS. No need to touch
- `next.config.js` - defines custom environment variables for our application
- `tsconfig.json` - defines the TypeScript environment. It's managed by NextJS but it can be adjusted when necessary
- `jest.config.js`, `jest.setup.js`, `tsconfig.jest.json` - setup the testing environment

### Running a Server

We are entirely reliant on NextJS for deployments. NextJS applications are deployed by running Node. This repo tries to follow NextJS best practices to build as small and fast applications as possible. NextJS heavily encourages server-side pre-rendering and offers two techniques to do so: (1) static rendering and (2) on-demand server-side rendering. Strategy (1) is faster because NextJS will fetch the data once, build new HTML, JS, and CSS files, and then simply serve the same files to any client that asks for them. Strategy (2) is slower because it has to uniquely render the page for each request. We try to use strategy (1) as much as possible.

During the build phase of a NextJS server:

1. NextJS transpiles all the fancy TypeScript, JSX, and React into vanilla HTML, CSS, and JS code.
2. Whenever possible, it prepopulates static pages with data

Once the server is running:

1. NextJS responds to requests with the statically generated files
2. Whenever possible, it will pre-render pages before sending them to clients

There's more to discuss on this topic after we define how pages are structured.

#### How Routes/Pages Are Defined

[Documentation](https://nextjs.org/docs/basic-features/pages)

The number one rule of NextJS is that _any_ JavaScript or TypeScript file in the `pages/` directory gets turned into an actual page of our website. The structure of the pages directory reflects the structure of the routes of our website. So `pages/index.tsx` is the root of the website, `https://oururl`. `pages/foo.tsx` turns into `https://oururl/foo`. `pages/foo/bar.tsx` turns into `https://oururl/foo/bar`. Dynamic routes works too. `pages/foo/[id].tsx` turns into `https://oururl/foo/1`, where the `id`, `1`, gets passed as a prop to the React component representing this page.

So if you want to create a new page, just add a new TypeScript file to the `pages/` directory with the route you want your page to have!

#### Server Code vs Client Code

[Documentation on pre-rendering](https://nextjs.org/docs/basic-features/pages#two-forms-of-pre-rendering)

We control when and how NextJS pre-renders pages with magic functions in our pages files. When used in this repo, we leave a lot of comments to explain what's going on.

Note that this means we have server-side and client-side code living in the same files! We have to be especially careful about what APIs we use because of incompatibilities between the Node (server) environment and the browser environment. Wherever relevant in this repo, we mark code that can only be run in a specific environment.

### Pages vs Components

A page represents a unique route on the website. In this repo, the code in a page file should be unique to that page. For example, we define the specific data sources for pre-populating that page. We may also define a new `<head>` to alter things like the `<title>`.

Components, on the other hand, are shared and reusable. A page should import the components it needs to structure the visible content it should render. Components should be thought of as functions wherein data is passed in and that alone determines how the component renders some visible thing on the page.

Thus, a page should import the components it needs and pass data to the components that defines the look and behavior of that specific page. Components should not make any assumptions about anything _above_ them in the page. All they know is what they're told by their parent.

Components are free to import and use subcomponents as much as possible. It's a good idea to break repeatedly used elements into their own components. The same strategy applies where parent components should pass data to their subcomponents to define their look and behavior.

#### Create a New Component

Components are stored in `components/`. Their filenames generally correspond to the default export of each file. But it's totally acceptable for a file in `components/` to export multiple components if there is a logical connection between them.

### OLD Local Variables and Global State

- [Documentation on hooks](https://reactjs.org/docs/hooks-intro.html)
- [Documentation on useContext hook](https://reactjs.org/docs/hooks-reference.html#usecontext)
- [Documentation on useReducer hook](https://reactjs.org/docs/hooks-reference.html#usereducer)
- [Our general strategy for global state](https://reactjs.org/docs/hooks-faq.html#how-to-avoid-passing-callbacks-down)

The repo uses React function components, which means we're defining chunks of the UI (ie, the DOM) as functions that take arguments and return HTML. In React, those arguments are called `props`. These components are generally "pure" functions that deterministically return HTML based only on the `props` passed to them.

However, we also have a global state, or `store`, that can be accessed by any page or component. Generally, you want to minimize the use of the store, but it can come in handy. One instance where you may want to use the store is when a user clicks in the navigation timeline. The video players are not children of the navigation timeline, so you need another way tell the video players to jump to the time the user just selected. Broadly, the two approaches you could take are either passing a value up and down the tree of components, or having a separate global state both components can access. For the former, you could create a variable at the parent element to both the navigation timeline and the video player, and when a user picks a time, you tell the parent element to update the time in both the navigation timeline and video player. React gives you a few ways to do this, but it can get cumbersome passing a lot of values up and down the tree of components. For the latter, React provides a method that takes advantage of a new API called "hooks". This is what we're using. We use a `context` hook, which is a [higher order component](https://reactjs.org/docs/higher-order-components.html) for accessing data anywhere in your application, and a `reducer` hook, for getting and setting values in the store.

Basically, you can wrap any component you want to be able to access the store in a context, and that gives it the ability to get and set values from the store. As soon as one component changes a value in the store, all other components will see the change and can react accordingly. The setup for this logic lives in `store/`.

### NEW Global State

- https://github.com/vercel/next.js/tree/canary/examples/with-redux
- https://github.com/vercel/next.js/tree/canary/examples/with-redux-toolkit

### Time

1. All times are stored internally in UTC
2. All durations are stored internally in seconds

## API Info

Which APIs we're interact with

### Imagery Online (IO)

The source of all the videos.

Example call to IO:

```sh
curl -H "Origin: https://coda-dev.fit.nasa.gov" "https://io.jsc.nasa.gov/api/search/rpp=500&s_dt=08-21-2019&e_dt=08-21-2019&as=2?key=put-your-key-here&format=json"
```

#### API Token

~Get one from the [IO website](https://io.jsc.nasa.gov/app/index.cfm)~ ask someone for one?

#### When New Videos Show Up

From James Montalvo

```
James Montalvo 4 minutes ago
Video is coming down real time, and at each LOS a new video file is cut. This makes most video files on an EVA day (when we're TDRS-critical and have lots of comm coverage) average around 30-40 minutes long, I think.

James Montalvo 4 minutes ago
So the fastest they could possibly get onto IO would be that 30-40 minutes...

James Montalvo 4 minutes ago
or, if you care about something that happened in the video right after an LOS, you're gonna wait that 30-40 minutes minimum for it.

James Montalvo 2 minutes ago
Around the start of the EVA the imagery curators (not sure if that's what they call themselves) start supporting the EVA. It is their job to take in the new video files and make sure they are properly annotated. In the last couple years, and especially since COVID, we've brought them into a Teams (in the past Skype) meeting to make it easier for them to stay up to speed with what's happening. This makes their annotations more accurate and faster.

James Montalvo 2 minutes ago
But it still adds a delay.

James Montalvo 1 minute ago
Early in the EVA they're pretty quick. Probably 0-5 minutes added time.

James Montalvo < 1 minute ago
Later in the day either due to fatigue or having to support other things or backlog of videos it seems to take longer

Another source of delay may be latency transferring from MCC to Building 8.

James Montalvo  < 1 minute ago
Since LOS applies to all downlinks, you're cutting 6 new files simultaneously

James Montalvo  < 1 minute ago
some of them HD
```

### ISS Wiki

We use the wiki dev server for our dev server.

## Deployments

TODO

GitLab CI variable file

```
NODE_EXTRA_CERTS_FILE=
```
