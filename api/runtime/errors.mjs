export class BadAuthException extends Error {
    constructor(message = "Request to resource requires an authenticated user.") {
        super(message);
        this.name = "BadAuthException";
    }
}
