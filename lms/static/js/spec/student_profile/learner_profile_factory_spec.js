define(['backbone', 'jquery', 'underscore', 'js/common_helpers/ajax_helpers', 'js/common_helpers/template_helpers',
        'js/spec/student_account/helpers',
        'js/spec/student_profile/helpers',
        'js/views/fields',
        'js/student_account/models/user_account_model',
        'js/student_account/models/user_preferences_model',
        'js/student_profile/views/learner_profile_view',
        'js/student_profile/views/learner_profile_fields',
        'js/student_profile/views/learner_profile_factory'
        ],
    function (Backbone, $, _, AjaxHelpers, TemplateHelpers, Helpers, LearnerProfileHelpers, FieldViews, UserAccountModel, UserPreferencesModel,
              LearnerProfileView, LearnerProfileFields, LearnerProfilePage) {
        'use strict';

        describe("edx.user.LearnerProfileFactory", function () {

            var requests;

            beforeEach(function () {
                setFixtures('<div class="wrapper-profile"><div class="ui-loading-indicator"><p><span class="spin"><i class="icon fa fa-refresh"></i></span> <span class="copy">Loading</span></p></div><div class="ui-loading-error is-hidden"><i class="fa fa-exclamation-triangle message-error" aria-hidden=true></i><span class="copy">An error occurred. Please reload the page.</span></div></div>');
                TemplateHelpers.installTemplate('templates/fields/field_readonly');
                TemplateHelpers.installTemplate('templates/fields/field_dropdown');
                TemplateHelpers.installTemplate('templates/fields/field_textarea');
                TemplateHelpers.installTemplate('templates/student_profile/learner_profile');
            });

            it("show loading error when UserAccountModel fails to load", function() {

                requests = AjaxHelpers.requests(this);

                var context = LearnerProfilePage({
                    'accounts_api_url': Helpers.USER_ACCOUNTS_API_URL,
                    'preferences_api_url': Helpers.USER_PREFERENCES_API_URL,
                    'own_profile': true,
                    'account_settings_page_url': Helpers.USER_ACCOUNTS_API_URL,
                    'country_options': Helpers.FIELD_OPTIONS,
                    'language_options': Helpers.FIELD_OPTIONS,
                    'has_preferences_access': true
                }),
                    learnerProfileView = context.learnerProfileView;

                Helpers.expectLoadingIndicatorIsVisible(learnerProfileView, true);
                Helpers.expectLoadingErrorIsVisible(learnerProfileView, false);
                LearnerProfileHelpers.expectProfileSectionsNotToBeRendered(learnerProfileView);


                var userAccountRequest = requests[0];
                expect(userAccountRequest.method).toBe('GET');
                expect(userAccountRequest.url).toBe(Helpers.USER_ACCOUNTS_API_URL);

                AjaxHelpers.respondWithError(requests, 500);

                Helpers.expectLoadingErrorIsVisible(learnerProfileView, true);
                Helpers.expectLoadingIndicatorIsVisible(learnerProfileView, false);
                LearnerProfileHelpers.expectProfileSectionsNotToBeRendered(learnerProfileView);
            });

            it("shows loading error when UserPreferencesModel fails to load", function() {

                requests = AjaxHelpers.requests(this);

                var context = LearnerProfilePage({
                    'accounts_api_url': Helpers.USER_ACCOUNTS_API_URL,
                    'preferences_api_url': Helpers.USER_PREFERENCES_API_URL,
                    'own_profile': true,
                    'account_settings_page_url': Helpers.USER_ACCOUNTS_API_URL,
                    'country_options': Helpers.FIELD_OPTIONS,
                    'language_options': Helpers.FIELD_OPTIONS,
                    'has_preferences_access': true
                }),
                    learnerProfileView = context.learnerProfileView;

                Helpers.expectLoadingIndicatorIsVisible(learnerProfileView, true);
                Helpers.expectLoadingErrorIsVisible(learnerProfileView, false);
                LearnerProfileHelpers.expectProfileSectionsNotToBeRendered(learnerProfileView);

                var userAccountRequest = requests[0];
                expect(userAccountRequest.method).toBe('GET');
                expect(userAccountRequest.url).toBe(Helpers.USER_ACCOUNTS_API_URL);

                AjaxHelpers.respondWithJson(requests, Helpers.USER_ACCOUNTS_DATA);
                Helpers.expectLoadingIndicatorIsVisible(learnerProfileView, true);
                Helpers.expectLoadingErrorIsVisible(learnerProfileView, false);
                LearnerProfileHelpers.expectProfileSectionsNotToBeRendered(learnerProfileView);

                var userPreferencesRequest = requests[1];
                expect(userPreferencesRequest.method).toBe('GET');
                expect(userPreferencesRequest.url).toBe(Helpers.USER_PREFERENCES_API_URL);

                AjaxHelpers.respondWithError(requests, 500);
                Helpers.expectLoadingIndicatorIsVisible(learnerProfileView, false);
                Helpers.expectLoadingErrorIsVisible(learnerProfileView, true);
                LearnerProfileHelpers.expectProfileSectionsNotToBeRendered(learnerProfileView);
            });

            it("renders the limited profile after models are successfully fetched", function() {

                requests = AjaxHelpers.requests(this);

                var context = LearnerProfilePage({
                    'accounts_api_url': Helpers.USER_ACCOUNTS_API_URL,
                    'preferences_api_url': Helpers.USER_PREFERENCES_API_URL,
                    'own_profile': true,
                    'account_settings_page_url': Helpers.USER_ACCOUNTS_API_URL,
                    'country_options': Helpers.FIELD_OPTIONS,
                    'language_options': Helpers.FIELD_OPTIONS,
                    'has_preferences_access': true
                });

                var learnerProfileView = context.learnerProfileView;

                Helpers.expectLoadingIndicatorIsVisible(learnerProfileView, true);
                Helpers.expectLoadingErrorIsVisible(learnerProfileView, false);
                LearnerProfileHelpers.expectProfileSectionsNotToBeRendered(learnerProfileView);

                AjaxHelpers.respondWithJson(requests, Helpers.USER_ACCOUNTS_DATA);
                AjaxHelpers.respondWithJson(requests, Helpers.USER_PREFERENCES_DATA);

                Helpers.expectLoadingErrorIsVisible(learnerProfileView, false);
                LearnerProfileHelpers.expectLimitedProfileSectionsAndFieldsToBeRendered(learnerProfileView)
            });
            
            it("renders the full profile after models are successfully fetched", function() {

                requests = AjaxHelpers.requests(this);

                var context = LearnerProfilePage({
                    'accounts_api_url': Helpers.USER_ACCOUNTS_API_URL,
                    'preferences_api_url': Helpers.USER_PREFERENCES_API_URL,
                    'own_profile': true,
                    'account_settings_page_url': Helpers.USER_ACCOUNTS_API_URL,
                    'country_options': Helpers.FIELD_OPTIONS,
                    'language_options': Helpers.FIELD_OPTIONS,
                    'has_preferences_access': true
                }),
                    learnerProfileView = context.learnerProfileView;

                Helpers.expectLoadingIndicatorIsVisible(learnerProfileView, true);
                Helpers.expectLoadingErrorIsVisible(learnerProfileView, false);
                LearnerProfileHelpers.expectProfileSectionsNotToBeRendered(learnerProfileView);

                var accountSettingsData = Helpers.USER_ACCOUNTS_DATA;
                accountSettingsData['year_of_birth'] = 1989;
                accountSettingsData['requires_parental_consent'] = false;

                AjaxHelpers.respondWithJson(requests, accountSettingsData);
                AjaxHelpers.respondWithJson(requests, Helpers.USER_PREFERENCES_DATA);

                // sets the profile for full view.
                context.accountPreferencesModel.set({account_privacy: 'all_users'});
                LearnerProfileHelpers.expectProfileSectionsAndFieldsToBeRendered(learnerProfileView, false)
            });

            it("renders the limited profile for undefined 'year_of_birth'", function() {

                requests = AjaxHelpers.requests(this);

                var context = LearnerProfilePage({
                    'accounts_api_url': Helpers.USER_ACCOUNTS_API_URL,
                    'preferences_api_url': Helpers.USER_PREFERENCES_API_URL,
                    'own_profile': true,
                    'account_settings_page_url': Helpers.USER_ACCOUNTS_API_URL,
                    'country_options': Helpers.FIELD_OPTIONS,
                    'language_options': Helpers.FIELD_OPTIONS,
                    'has_preferences_access': true
                }),
                    learnerProfileView = context.learnerProfileView;

                Helpers.expectLoadingIndicatorIsVisible(learnerProfileView, true);
                Helpers.expectLoadingErrorIsVisible(learnerProfileView, false);
                LearnerProfileHelpers.expectProfileSectionsNotToBeRendered(learnerProfileView);

                AjaxHelpers.respondWithJson(requests, Helpers.USER_ACCOUNTS_DATA);
                AjaxHelpers.respondWithJson(requests, Helpers.USER_PREFERENCES_DATA);

                LearnerProfileHelpers.expectLimitedProfileSectionsAndFieldsToBeRendered(learnerProfileView)
            });

            it("renders the limited profile for under 13 users", function() {

                requests = AjaxHelpers.requests(this);

                var context = LearnerProfilePage({
                    'accounts_api_url': Helpers.USER_ACCOUNTS_API_URL,
                    'preferences_api_url': Helpers.USER_PREFERENCES_API_URL,
                    'own_profile': true,
                    'account_settings_page_url': Helpers.USER_ACCOUNTS_API_URL,
                    'country_options': Helpers.FIELD_OPTIONS,
                    'language_options': Helpers.FIELD_OPTIONS,
                    'has_preferences_access': true
                }),
                    learnerProfileView = context.learnerProfileView;

                Helpers.expectLoadingIndicatorIsVisible(learnerProfileView, true);
                Helpers.expectLoadingErrorIsVisible(learnerProfileView, false);
                LearnerProfileHelpers.expectProfileSectionsNotToBeRendered(learnerProfileView);

                var accountSettingsData = Helpers.USER_ACCOUNTS_DATA;
                accountSettingsData['requires_parental_consent'] = true;

                AjaxHelpers.respondWithJson(requests, accountSettingsData);
                AjaxHelpers.respondWithJson(requests, Helpers.USER_PREFERENCES_DATA);

                LearnerProfileHelpers.expectLimitedProfileSectionsAndFieldsToBeRendered(learnerProfileView)
            });

            it("renders the limited profile for other user who is under 13", function() {

                requests = AjaxHelpers.requests(this);

                var context = LearnerProfilePage({
                    'accounts_api_url': Helpers.USER_ACCOUNTS_API_URL,
                    'preferences_api_url': Helpers.USER_PREFERENCES_API_URL,
                    'own_profile': false,
                    'account_settings_page_url': Helpers.USER_ACCOUNTS_API_URL,
                    'country_options': Helpers.FIELD_OPTIONS,
                    'language_options': Helpers.FIELD_OPTIONS,
                    'has_preferences_access': true
                }),
                    learnerProfileView = context.learnerProfileView;

                Helpers.expectLoadingIndicatorIsVisible(learnerProfileView, true);
                Helpers.expectLoadingErrorIsVisible(learnerProfileView, false);
                LearnerProfileHelpers.expectProfileSectionsNotToBeRendered(learnerProfileView);

                var accountSettingsData = Helpers.USER_ACCOUNTS_DATA;
                accountSettingsData['requires_parental_consent'] = true;

                AjaxHelpers.respondWithJson(requests, accountSettingsData);
                AjaxHelpers.respondWithJson(requests, Helpers.USER_PREFERENCES_DATA);

                LearnerProfileHelpers.expectLimitedProfileSectionsAndFieldsToBeRendered(learnerProfileView)
            });
        });
    });
