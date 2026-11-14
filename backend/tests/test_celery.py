def test_delivery_task_is_loaded_by_celery_worker():
    from app.core.celery_app import celery_app

    celery_app.loader.import_default_modules()

    assert "app.tasks.webhook_tasks.deliver_webhook_task" in celery_app.tasks
    assert (
        celery_app.conf.task_routes["app.tasks.webhook_tasks.deliver_webhook_task"][
            "queue"
        ]
        == "webhooks"
    )
