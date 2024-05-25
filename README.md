# :cloud: Clouds :cloud:
![Screenshot of the Clouds web desktop environment](docs/sample.webp)

## :question: What is it?
**Clouds** is a multi-purpose web environment, runnable locally on the user machine or on a server. The provided environment is accessible through any modern web browser, allowing its core functionality to be available on any number of devices, including but not limited to: PCs, Smartphones, Smart TVs, etc.

Here's a list of some things you can do with **Clouds**:

* Stream content from your computer or laptop to your TV;
* Manage local/remote media server files with an intuitive interface.
* Transfer files between your Phone and your computer with ease;
* View documents like PDFs on any capable browser directly in the UI;
* Invoke shell and sysadmin commands remotely from any of your devices;
* And more to come!

**Clouds** uses the concept of **apps** to perform many functionalities on its environment. **Apps** are separate from the core system, and can be developed independently from the rest of the project, allowing **flexibility** and most importantly **extensibility**.

## :file_folder: Structure

This project consists of two separate entities: The **API** and the **Client** core. 
- **API**: Encompasses all the functionalities pertaining to the services provided in the server. Targets the _server_ device. It uses **Node.js** with **Express** to provide a simple but powerful routing system consumed by the web client.

- **Client**: Encompasses all subsystems targeting the _client_ device, that is, the web browser accessing the web interface. Includes the classes responsible for the interface as well as the built-in **Apps**. Uses standard modern JavaScript, compiled through **Webpack** and **Babel** for better performance and support of older devices.

Directory|Purpose
:-|:-
api/modules/|Core classes used by the Node.js server.
api/pages/|Web pages loaded by the client when initializing the system.
client/apps/|Contains a folder for every built-in app available on the system. An app folder contains a manifest, modules and resources used by the app.
client/res/|Static general resources, accessible directly by the client web browser.
client/src/|Source code for the core client modules. These are compiled into final static resources.
config/|Configuration used by the server.
docs/|Files associated with the repo documentation.
usr/|Contains a folder for each user in the web system. Provides a dedicated space that can be used by the client user.

## :package: Building
To be added...

## :arrow_forward: Running
To be added...