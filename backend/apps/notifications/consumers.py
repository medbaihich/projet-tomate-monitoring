from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.notifications.services import NOTIFICATIONS_GROUP_NAME


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return

        await self.channel_layer.group_add(NOTIFICATIONS_GROUP_NAME, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(NOTIFICATIONS_GROUP_NAME, self.channel_name)

    async def notification_created(self, event):
        await self.send_json(
            {
                "type": "notification.created",
                "notification": event["notification"],
            }
        )
