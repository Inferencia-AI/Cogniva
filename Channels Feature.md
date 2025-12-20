# Channels/Knowledgbase Feature
A table to store knowledgebase information including banner, image, name, description, associated notes, and managers with specific roles: 

```sql
CREATE TABLE "knowledgebase" (
  "id" integer PRIMARY KEY
    GENERATED ALWAYS AS IDENTITY
    (sequence name "knowledgebase_id_seq"),

  "banner_url" text,
  "image_url" text,
  "name" text,
  "description" text,
  "notes_ids" text[],
  "managers" jsonb[],
  "subscribers_ids" text[],

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
```

# A Backend Route

```md
## GET /knowledgebase/{id}
Retrieve knowledgebase details by ID.
- **Response:**
  - `200 OK`: Returns the knowledgebase details including banner, image, name, description, notes, and managers.
  - `404 Not Found`: If the knowledgebase with the specified ID does not exist.
## POST /knowledgebase
Create a new knowledgebase.
- **Request Body:**
  - `banner_url`: URL of the banner image.
  - `image_url`: URL of the image.
  - `name`: Name of the knowledgebase.
  - `description`: Description of the knowledgebase.

- **Response:**
    - `201 Created`: Returns the created knowledgebase details.
    - `400 Bad Request`: If the request body is invalid.
## PUT /knowledgebase/{id}
Update an existing knowledgebase by ID.
- **Request Body:**
  - `banner_url`: URL of the banner image.
  - `image_url`: URL of the image.
  - `name`: Name of the knowledgebase.
  - `description`: Description of the knowledgebase.
  - `managers`: Updated list of managers with roles.
- **Response:**
    - `200 OK`: Returns the updated knowledgebase details.
    - `400 Bad Request`: If the request body is invalid.
    - `404 Not Found`: If the knowledgebase with the specified ID does not exist.
## DELETE /knowledgebase/{id}
Delete a knowledgebase by ID.
- **Response:**
    - `204 No Content`: If the knowledgebase was successfully deleted.
    - `404 Not Found`: If the knowledgebase with the specified ID does not exist.
## POST /knowledgebase/{id}/subscribe
Subscribe a user to the knowledgebase.
- **Request Body:**
  - `user_id`: ID of the user to subscribe.
- **Response:**
    - `200 OK`: If the user was successfully subscribed.
    - `404 Not Found`: If the knowledgebase with the specified ID does not exist.
## POST /knowledgebase/{id}/unsubscribe
Unsubscribe a user from the knowledgebase.
- **Request Body:**
  - `user_id`: ID of the user to unsubscribe.
- **Response:**
    - `200 OK`: If the user was successfully unsubscribed.
    - `404 Not Found`: If the knowledgebase with the specified ID does not exist.
## GET /knowledgebase/{id}/subscribers
Retrieve the list of subscribers for a knowledgebase by ID.
- **Response:**
    - `200 OK`: Returns the list of subscribers.
    - `404 Not Found`: If the knowledgebase with the specified ID does not exist.
## POST /knowledgebase/search
Search knowledgebases by name or description.
- **Request Body:**
    - `query`: Search query string.
- **Response:**
    - `200 OK`: Returns a list of knowledgebases matching the search criteria.
## GET /knowledgebase/{id}/home
- Retrieve data for knowledgebase home page including featured knowledgebases, subscribed updates, and my knowledgebase.
- **Response:**
    - `200 OK`: Returns the home page data for the knowledgebase.
    - `404 Not Found`: If the knowledgebase with the specified ID does not exist.
## POST /knowledgebase/query
- Ask questions, the notes from knowledgebase will be retrieved and answer generated based on the content of the notes.
- **Request Body:**
    - `question`: The question to ask.
- **Response:**
    - `200 OK`: Returns the fetched notes (PS: The generation endpoint is /chat in the codebase of backend)

# Additional
A search route for notes to be implemented, notes table is already created in the database schema and it has knowledgebase_id as integer, only those notes which are part of any knowledgebase will be shown in the search results when searching from knowledgebase page, not user's personal notes.
```

# Frontend Routes

```md
## Knowledgebase Home Page
*Route*: `/knowledgebase/home`
- Displays featured knowledgebases, updates from subscribed knowledgebases, and user's own knowledgebases.
*api to use*: `GET /knowledgebase/{id}/home`, `POST /knowledgebase/search`
*structure*:
```psudo
[Header]
[SearchBar With Suggestions and Results][
    Input field to search knowledgebases by name or description, similar matching knowledgebases shown as suggestions and results will be listed below. has a filter option to filter between notes and knowledgebases
]
[FeaturedKnowledgebases][
    List of featured knowledgebases with banner, image, name, and description
]
[SubscribedUpdates][
    List of latest notes that have been added or updated in knowledgebases, only three latest notes from each subscribed knowledgebase are shown with show more button
]
[MyKnowledgebases][
    List of knowledgebases the user is a member/admin of with banner, image, name, and description and option to manage or view
]
[Footer]
```
## Specific Knowledgebase Page
*Route*: `/knowledgebase/{id}`
- Displays details of a specific knowledgebase including banner, image, name, description, notes, and managers.
*api to use*: `GET /knowledgebase/{id}`, `POST /knowledgebase/{id}/subscribe`, `POST /knowledgebase/{id}/unsubscribe`, `GET /knowledgebase/{id}/subscribers`
*structure*:
```psudo
[Header]
[KnowledgebaseBanner][
    Banner Image
    Knowledgebase Image
    Name
    Description
    Subscribe/Unsubscribe Button]
[Subscribers Count]
[Managers List with roles (only for admins)][
    List of managers with their roles and option to manage (only for admins)
]
[Notes List][
    List of notes associated with the knowledgebase with options to view, suggest edits, or approve/reject (based on user role)
]
[Footer]
```
## Create/Edit Knowledgebase Page
*Route*: `/knowledgebase/create` or `/knowledgebase/{id}/edit`
- Form to create a new knowledgebase or edit an existing one.
*api to use*: `POST /knowledgebase`, `PUT /knowledgebase/{id}`
*structure*:
```psudo
[Header]
[KnowledgebaseForm][
    Uploader for banner URL, image URL, Input field for name, description
    Submit Button,
    For admin: Manager assignment section to add/remove managers and assign roles
]
[Suggested Notes Section (only for edit)][
    List of suggested notes with options to approve/reject (only for approvers/admins)
]
[Footer]
```
