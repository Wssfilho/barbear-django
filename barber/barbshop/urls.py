from .views import BarbshopModelViewSet
from rest_framework.routers import DefaultRouter

Brouter = DefaultRouter()
Brouter.register(r'barbshop', BarbshopModelViewSet, basename='barbshop')
urlpatterns = Brouter.urls
