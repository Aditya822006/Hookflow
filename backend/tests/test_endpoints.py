from fastapi import status


def test_create_endpoint_success(client):
    response = client.post(
        "/api/v1/endpoints",
        json={
            "name": "Production Stripe Webhook",
            "url": "https://api.example.com/webhooks/orders",
            "description": "Handles live order placed webhooks",
            "secret_token": "secret_abc123",
            "is_active": True,
        },
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["name"] == "Production Stripe Webhook"
    assert data["url"] == "https://api.example.com/webhooks/orders"
    assert data["is_active"] is True
    assert data["has_secret"] is True
    assert "secret_token" not in data
    assert "id" in data


def test_create_endpoint_invalid_url(client):
    # Missing scheme (e.g., "invalid-url-without-scheme")
    response = client.post(
        "/api/v1/endpoints",
        json={"name": "Bad Endpoint", "url": "not-a-valid-url"},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Missing host
    response2 = client.post(
        "/api/v1/endpoints",
        json={"name": "Bad Endpoint", "url": "http://"},
    )
    assert response2.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_create_endpoint_duplicate_url(client, sample_endpoint):
    response = client.post(
        "/api/v1/endpoints",
        json={
            "name": "Duplicate URL Endpoint",
            "url": sample_endpoint.url,
        },
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "already registered" in response.json()["detail"].lower()


def test_list_endpoints(client, sample_endpoint):
    response = client.get("/api/v1/endpoints")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) >= 1
    urls = [ep["url"] for ep in data]
    assert sample_endpoint.url in urls


def test_get_endpoint_by_id(client, sample_endpoint):
    response = client.get(f"/api/v1/endpoints/{sample_endpoint.id}")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == sample_endpoint.id
    assert data["name"] == sample_endpoint.name


def test_get_endpoint_not_found(client):
    response = client.get("/api/v1/endpoints/99999")
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_toggle_endpoint_status(client, sample_endpoint):
    assert sample_endpoint.is_active is True

    # Toggle to False
    res1 = client.post(f"/api/v1/endpoints/{sample_endpoint.id}/toggle")
    assert res1.status_code == status.HTTP_200_OK
    assert res1.json()["is_active"] is False

    # Toggle back to True
    res2 = client.post(f"/api/v1/endpoints/{sample_endpoint.id}/toggle")
    assert res2.status_code == status.HTTP_200_OK
    assert res2.json()["is_active"] is True


def test_delete_endpoint(client, sample_endpoint):
    del_res = client.delete(f"/api/v1/endpoints/{sample_endpoint.id}")
    assert del_res.status_code == status.HTTP_204_NO_CONTENT

    # Verify endpoint is gone
    get_res = client.get(f"/api/v1/endpoints/{sample_endpoint.id}")
    assert get_res.status_code == status.HTTP_404_NOT_FOUND


def test_update_endpoint_rejects_duplicate_destination_url(client, sample_endpoint):
    other = client.post(
        "/api/v1/endpoints",
        json={"name": "Other endpoint", "url": "https://other.example/webhook"},
    )
    assert other.status_code == status.HTTP_201_CREATED

    response = client.patch(
        f"/api/v1/endpoints/{other.json()['id']}",
        json={"url": sample_endpoint.url},
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
