import json
import re
import time

ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


def test_create_list_get_save(client):
    assert client.get("/api/getFunnel/getAll").json() == []

    assert client.post("/api/getFunnel/create-new-webpage", json={"id": "p1", "name": "First"}).json() == {"result": True}
    time.sleep(0.01)
    client.post("/api/getFunnel/create-new-webpage", json={"id": "p2", "name": "Second"})

    pages = client.get("/api/getFunnel/getAll").json()
    assert [p["id"] for p in pages] == ["p2", "p1"]  # most recently updated first
    assert set(pages[0]) == {"id", "name", "updatedAt"}
    assert ISO.match(pages[0]["updatedAt"])

    page = client.get("/api/getFunnel/p1").json()
    assert page["name"] == "First" and page["content"] == "" and page["previewImage"] is None
    assert page["__v"] == 0 and isinstance(page["_id"], str)
    assert ISO.match(page["createdAt"])

    tree = [{"id": "__body", "name": "Body", "type": "__body", "styles": {}, "content": [{"id": "t", "name": "Text", "type": "text", "styles": {}, "content": {"innerText": "Héllo"}}]}]
    time.sleep(0.01)
    assert client.post("/api/getFunnel/p1", json=tree).json() == {"result": True}
    saved = client.get("/api/getFunnel/p1").json()
    # Stored exactly like JSON.stringify: compact, unicode kept.
    assert saved["content"] == json.dumps(tree, separators=(",", ":"), ensure_ascii=False)
    assert '"Héllo"' in saved["content"]
    assert saved["updatedAt"] > saved["createdAt"]
    assert [p["id"] for p in client.get("/api/getFunnel/getAll").json()] == ["p1", "p2"]


def test_missing_page_returns_null(client):
    response = client.get("/api/getFunnel/does-not-exist")
    assert response.status_code == 200
    assert response.text == "null"
    assert response.headers["cache-control"] == "no-store"


def test_save_unknown_page_is_a_no_op(client):
    assert client.post("/api/getFunnel/nope", json=[]).json() == {"result": True}
    assert client.get("/api/getFunnel/nope").text == "null"


def test_delete_removes_only_that_page(client):
    client.post("/api/getFunnel/create-new-webpage", json={"id": "keep", "name": "Keep"})
    client.post("/api/getFunnel/create-new-webpage", json={"id": "gone", "name": "Gone"})

    assert client.delete("/api/getFunnel/gone").json() == {"result": True}

    assert client.get("/api/getFunnel/gone").text == "null"
    assert [p["id"] for p in client.get("/api/getFunnel/getAll").json()] == ["keep"]


def test_delete_unknown_page_is_not_found(client):
    assert client.delete("/api/getFunnel/nope").status_code == 404


def test_create_requires_id_and_name(client):
    assert client.post("/api/getFunnel/create-new-webpage", json={"name": "x"}).status_code == 400
    assert client.post("/api/getFunnel/create-new-webpage", json={"id": "x", "name": ""}).status_code == 422
