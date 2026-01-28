from .views import schedulingModelViewSet
from rest_framework.routers import DefaultRouter

Qrouter = DefaultRouter()
Qrouter.register(r'scheduling', schedulingModelViewSet, basename='scheduling')
urlpatterns = Qrouter.urls
