# :cloud: Clouds :cloud:

<div align="center">

### :zap: Powered By :zap:

</div>

<div align="center">

![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
<br>
![Esbuild](https://img.shields.io/badge/esbuild-%23FFCF00.svg?style=for-the-badge&logo=esbuild&logoColor=black)![SWC](https://img.shields.io/badge/SWC-282828?style=for-the-badge&logo=swc)![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)![SASS](https://img.shields.io/badge/SASS-hotpink.svg?style=for-the-badge&logo=SASS&logoColor=white)

</div>

![Screenshot of the Clouds web desktop environment](docs/sample.webp)

## :question: What is it?
**Clouds** is a multi-purpose web environment, runnable locally on the user machine or on a server. The provided environment is accessible through any modern web browser, allowing its core functionality to be available on any number of devices, including but not limited to: PCs, Smartphones and Smart TVs.

Here's a list of some things you can do with **Clouds**:

* Stream content from your computer or laptop to your TV
* Manage local/remote media server files with an intuitive interface
* Transfer files between your Phone and your computer with ease
* View documents like PDFs on any capable browser directly in the UI
* Invoke shell and sysadmin commands remotely from any of your devices
* And more to come!

**Clouds** uses the concept of **apps** to perform many functionalities on its environment. **Apps** are separate from the core system, and can be developed independently from the rest of the project, allowing **flexibility** and most importantly **extensibility**.

## :package: Building
You must install all NPM dependencies. Some dependencies are meant to be used at runtime and others are build tools.
Here's the main dependencies of the project, the ones listed in _italics_ are _dev dependencies_:

Dependency|API|Client
:-|:-|:-
Express|Yes|No
EJS|Yes|No
_TypeScript_|Yes|Yes
_SWC_|No|Yes
_ESBuild_|No|Yes
_Sass_|No|Yes

All of these dependencies can be installed with: ```> pnpm install``` on the root of a fresh clone of the repository.

## :arrow_forward: Running
Once all dependencies are installed successfully, you can execute the matching script ```> run.bat``` or ```> ./run.sh```. The script will automatically execute the proper pnpm scripts to build the submodules (api, client, apps).

Then, it will fire up a new server on the current machine that will start listening for new connections. The terminal will stay open and log some of the user activities. Which activities are logged can be configured in the profiles stored in the configuration profiles.

## :gear: Configuration
You are done! The server already comes pre-configured on port ```8000```. A built-in user named ```test``` will already be configured to use.

You can configure the behavior of the server through the profiles stored in ```config/profiles/```. The default profile is already well configured, but you might want to change a few settings.

## :construction: Developing

There are many package scripts you can use to build and develop the project. These follow the following pattern:
```<module>:<operation>:<mode>:<watch>```

Where:

Part|Purpose
:-|:-
module|Which submodule of the project are you referring to. May be one of ```api```, ```client``` or ```apps```.
operation|What action to perform on the module. May be one of ```build``` or ```check```.
mode|What environment mode you wish to use when executing build tasks. Might be ```prod``` or ```devl```.
watch|Optional for build tasks. If provided, will build the submodule and watch for further changes.


Here's a list of the most important package scripts defined. These can be run using: ```> pnpm <script>```. Checkout ```package.json``` for all the scripts available.
Script|Purpose
:-|:-
api:build|Compiles all the TypeScript API files in /api/src/ to /api/dist/
client:build:prod|Compiles and bundles the Core client modules in /client/src/ to /client/public/pack/ in production mode.
client:build:devl:watch|Compiles and bundles the Core client modules in /client/src/ to /client/res/js/ in development mode, then keeps watching for further changes.
client:check|Runs TypeScript compiler type checking on Client code and emits declaration files on /client/types/ folder.
apps:build:prod:watch|Compiles apps on /apps/ in production mode, then stay watching for changes in any of the apps code.
apps:build:devl|Compiles apps on /apps/ in development mode.
analyze|Compiles ```client``` and ```apps``` submodules to analyze bundle size.


### :file_folder: Structure

This project consists of three separate entities: The **API**, the **Client** core and the included **Apps**. 
- **API**: Encompasses all the functionalities pertaining to the services provided in the server. Targets the _server_ device. It uses **Node.js** with **Express** to provide a simple but powerful routing system consumed by the web client.

- **Client**: Encompasses all subsystems targeting the _client_ device, that is, the web browser accessing the web interface. Uses standard modern TypeScript, compiled using custom tooling with **ESBuild** and **SWC** for better performance and support of older devices. Consumes the API through the browser.

- **Apps**: Built-in apps written in TypeScript to provide support to basic functionalities in the environment. These are also compiled through **ESBuild** and **SWC** to provide performance and support of older devices. These apps are compiled against the client core platform.

Directory|Purpose
:-|:-
api/src/|Core classes written in **TypeScript** used by the Node.js server. These must be compiled.
api/dist/|Compiled core classes from source. These are generated by the **tsc** compiler.
api/pages/|Web pages loaded by the client when initializing the system.
client/src/|**TypeScript** source code for the core client modules. These are compiled into final static resources.
client/public/|Static general resources, accessible directly by the client web browser.
apps/|Contains a folder for every built-in app available on the system. An app folder contains a manifest, modules and resources used by the app.
config/|Configuration used by the server.
docs/|Files associated with the repo documentation.
usr/|Contains a folder for each user in the web system. Provides a dedicated space that can be used by the client user.

### :scroll: API Routes

Route|Maps to|Purpose
:-|:-|:-
/|/client/pages/entry.ejs|Initial page.
/auth/|-|Authentication services: login, logout, test
/page/|/client/pages/|Fetching of core HTML pages, mainly login and desktop page.
/res/|/client/public/|Static resource access. All logged in users can access any content in this directory.
/app/**&lt;name&gt;**|/client/apps/**&lt;name&gt;**|Fetch static app resources.
/fsv/|_(User filesystem)_|Read/write file system access at the current path.
/fsmx/|_(User filesystem)_|Media extensions for the user filesystem
/shell/|-|Manage user remote shells.
/stat|-|Obtains system-wide status information.
