from .views import ServiceModelViewSet
from rest_framework.routers import DefaultRouter

Srouter = DefaultRouter()
Srouter.register(r'service', ServiceModelViewSet, basename='service')
urlpatterns = Srouter.urls
