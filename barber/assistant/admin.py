from django.contrib import admin
from .models import Plan


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'barbershop', 'service', 'monthly_price', 'included_visits', 'active')
    list_filter = ('active',)
    # Writes must go through the ownership and cross-service validation in the API.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
